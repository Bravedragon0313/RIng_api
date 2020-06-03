"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ring_types_1 = require("./ring-types");
const rest_client_1 = require("./rest-client");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const dgram_1 = require("dgram");
const rtp_utils_1 = require("./rtp-utils");
const util_1 = require("./util");
const sip_session_1 = require("./sip-session");
const snapshotRefreshDelay = 500, maxSnapshotRefreshSeconds = 30, maxSnapshotRefreshAttempts = (maxSnapshotRefreshSeconds * 1000) / snapshotRefreshDelay;
function parseBatteryLife(batteryLife) {
    if (batteryLife === null || batteryLife === undefined) {
        return null;
    }
    const batteryLevel = typeof batteryLife === 'number'
        ? batteryLife
        : Number.parseFloat(batteryLife);
    if (isNaN(batteryLevel)) {
        return null;
    }
    return batteryLevel;
}
function getBatteryLevel(data) {
    const levels = [
        parseBatteryLife(data.battery_life),
        parseBatteryLife(data.battery_life_2),
    ].filter((level) => level !== null);
    if (!levels.length) {
        return null;
    }
    return Math.min(...levels);
}
exports.getBatteryLevel = getBatteryLevel;
function getSearchQueryString(options) {
    const queryString = Object.entries(options)
        .map(([key, value]) => {
        if (value === undefined) {
            return '';
        }
        if (key === 'olderThanId') {
            key = 'pagination_key';
        }
        return `${key}=${value}`;
    })
        .filter((x) => x)
        .join('&');
    return queryString.length ? `?${queryString}` : '';
}
exports.getSearchQueryString = getSearchQueryString;
class RingCamera {
    constructor(initialData, isDoorbot, restClient) {
        this.initialData = initialData;
        this.isDoorbot = isDoorbot;
        this.restClient = restClient;
        this.id = this.initialData.id;
        this.deviceType = this.initialData.kind;
        this.model = ring_types_1.RingCameraModel[this.initialData.kind] || 'Unknown Model';
        this.onData = new rxjs_1.BehaviorSubject(this.initialData);
        this.hasLight = this.initialData.led_status !== undefined;
        this.hasSiren = this.initialData.siren_status !== undefined;
        this.hasBattery = ring_types_1.batteryCameraKinds.includes(this.deviceType) ||
            (typeof this.initialData.battery_life === 'string' &&
                this.batteryLevel !== null &&
                this.batteryLevel < 100 &&
                this.batteryLevel >= 0);
        this.onRequestUpdate = new rxjs_1.Subject();
        this.onRequestActiveDings = new rxjs_1.Subject();
        this.onNewDing = new rxjs_1.Subject();
        this.onActiveDings = new rxjs_1.BehaviorSubject([]);
        this.onDoorbellPressed = this.onNewDing.pipe(operators_1.filter((ding) => ding.kind === 'ding'), operators_1.share());
        this.onMotionDetected = this.onActiveDings.pipe(operators_1.map((dings) => dings.some((ding) => ding.motion || ding.kind === 'motion')), operators_1.distinctUntilChanged(), operators_1.publishReplay(1), operators_1.refCount());
        this.onBatteryLevel = this.onData.pipe(operators_1.map(getBatteryLevel), operators_1.distinctUntilChanged());
        this.onInHomeDoorbellStatus = this.onData.pipe(operators_1.map(({ settings: { chime_settings } }) => {
            return Boolean(chime_settings === null || chime_settings === void 0 ? void 0 : chime_settings.enable);
        }), operators_1.distinctUntilChanged());
        this.expiredDingIds = [];
        this.snapshotLifeTime = (this.hasBattery ? 600 : 30) * 1000; // battery cams only refresh timestamp every 10 minutes
        this.lastSnapshotTimestampLocal = 0;
        if (!initialData.subscribed) {
            this.subscribeToDingEvents().catch((e) => {
                util_1.logError('Failed to subscribe ' + initialData.description + ' to ding events');
                util_1.logError(e);
            });
        }
        if (!initialData.subscribed_motions) {
            this.subscribeToMotionEvents().catch((e) => {
                util_1.logError('Failed to subscribe ' + initialData.description + ' to motion events');
                util_1.logError(e);
            });
        }
    }
    updateData(update) {
        this.onData.next(update);
    }
    requestUpdate() {
        this.onRequestUpdate.next();
    }
    get data() {
        return this.onData.getValue();
    }
    get name() {
        return this.data.description;
    }
    get activeDings() {
        return this.onActiveDings.getValue();
    }
    get batteryLevel() {
        return getBatteryLevel(this.data);
    }
    get hasLowBattery() {
        return this.data.alerts.battery === 'low';
    }
    get isOffline() {
        return this.data.alerts.connection === 'offline';
    }
    get hasInHomeDoorbell() {
        const { chime_settings } = this.data.settings;
        return (this.isDoorbot &&
            Boolean(chime_settings &&
                [ring_types_1.DoorbellType.Mechanical, ring_types_1.DoorbellType.Digital].includes(chime_settings.type)));
    }
    doorbotUrl(path = '') {
        return rest_client_1.clientApi(`doorbots/${this.id}/${path}`);
    }
    setLight(on) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasLight) {
                return false;
            }
            const state = on ? 'on' : 'off';
            yield this.restClient.request({
                method: 'PUT',
                url: this.doorbotUrl('floodlight_light_' + state),
            });
            this.updateData(Object.assign(Object.assign({}, this.data), { led_status: state }));
            return true;
        });
    }
    setSiren(on) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasSiren) {
                return false;
            }
            const state = on ? 'on' : 'off';
            yield this.restClient.request({
                method: 'PUT',
                url: this.doorbotUrl('siren_' + state),
            });
            this.updateData(Object.assign(Object.assign({}, this.data), { siren_status: { seconds_remaining: 1 } }));
            return true;
        });
    }
    // Enable or disable the in-home doorbell (if digital or mechanical)
    setInHomeDoorbell(on) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasInHomeDoorbell) {
                return false;
            }
            yield this.restClient.request({
                method: 'PUT',
                url: this.doorbotUrl(),
                data: {
                    'doorbot[settings][chime_settings][enable]': on,
                },
            });
            this.requestUpdate();
            return true;
        });
    }
    getHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.restClient.request({
                url: this.doorbotUrl('health'),
            });
            return response.device_health;
        });
    }
    startVideoOnDemand() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('live_view'),
        });
    }
    pollForActiveDing() {
        // try every second until a new ding is received
        rxjs_1.interval(1000)
            .pipe(operators_1.takeUntil(this.onNewDing))
            .subscribe(() => {
            this.onRequestActiveDings.next();
        });
    }
    getSipConnectionDetails() {
        return __awaiter(this, void 0, void 0, function* () {
            const vodPromise = this.onNewDing.pipe(operators_1.take(1)).toPromise(), videoOnDemandDing = yield this.startVideoOnDemand();
            if (videoOnDemandDing &&
                'sip_from' in videoOnDemandDing &&
                !this.expiredDingIds.includes(videoOnDemandDing.id_str)) {
                // wired cams return a ding from live_view so we don't need to wait
                return videoOnDemandDing;
            }
            // battery cams return '' from live_view so we need to request active dings and wait
            this.pollForActiveDing();
            return vodPromise;
        });
    }
    removeDingById(idToRemove) {
        const allActiveDings = this.activeDings, otherDings = allActiveDings.filter((ding) => ding.id_str !== idToRemove);
        this.onActiveDings.next(otherDings);
    }
    processActiveDing(ding) {
        const activeDings = this.activeDings, dingId = ding.id_str;
        this.onNewDing.next(ding);
        this.onActiveDings.next(activeDings.filter((d) => d.id_str !== dingId).concat([ding]));
        setTimeout(() => {
            this.removeDingById(ding.id_str);
            this.expiredDingIds = this.expiredDingIds.filter((id) => id !== dingId);
        }, 65 * 1000); // dings last ~1 minute
    }
    getEvents(options) {
        return this.restClient.request({
            url: rest_client_1.clientApi(`locations/${this.data.location_id}/devices/${this.id}/events${getSearchQueryString(options)}`),
        });
    }
    getRecordingUrl(dingIdStr, { transcoded = false } = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = transcoded ? 'recording' : 'share/play', response = yield this.restClient.request({
                url: rest_client_1.clientApi(`dings/${dingIdStr}/${path}?disable_redirect=true`),
            });
            return response.url;
        });
    }
    isTimestampInLifeTime(timestampAge) {
        return timestampAge < this.snapshotLifeTime;
    }
    getSnapshotTimestamp() {
        return __awaiter(this, void 0, void 0, function* () {
            const { timestamps, responseTimestamp } = yield this.restClient.request({
                url: rest_client_1.clientApi('snapshots/timestamps'),
                method: 'POST',
                data: {
                    doorbot_ids: [this.id],
                },
                json: true,
            }), deviceTimestamp = timestamps[0], timestamp = deviceTimestamp ? deviceTimestamp.timestamp : 0, timestampAge = Math.abs(responseTimestamp - timestamp);
            this.lastSnapshotTimestampLocal = timestamp ? Date.now() - timestampAge : 0;
            return {
                timestamp,
                inLifeTime: this.isTimestampInLifeTime(timestampAge),
            };
        });
    }
    refreshSnapshot() {
        return __awaiter(this, void 0, void 0, function* () {
            const currentTimestampAge = Date.now() - this.lastSnapshotTimestampLocal;
            if (this.isTimestampInLifeTime(currentTimestampAge)) {
                util_1.logInfo(`Snapshot for ${this.name} is still within its life time (${currentTimestampAge / 1000}s old)`);
                return true;
            }
            for (let i = 0; i < maxSnapshotRefreshAttempts; i++) {
                const { timestamp, inLifeTime } = yield this.getSnapshotTimestamp();
                if (!timestamp && this.isOffline) {
                    throw new Error(`No snapshot available and device ${this.name} is offline`);
                }
                if (inLifeTime) {
                    return false;
                }
                yield util_1.delay(snapshotRefreshDelay);
            }
            throw new Error(`Snapshot failed to refresh after ${maxSnapshotRefreshAttempts} attempts`);
        });
    }
    getSnapshot(allowStale = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.refreshSnapshotInProgress =
                this.refreshSnapshotInProgress || this.refreshSnapshot();
            try {
                const useLastSnapshot = yield this.refreshSnapshotInProgress;
                if (useLastSnapshot && this.lastSnapshotPromise) {
                    this.refreshSnapshotInProgress = undefined;
                    return this.lastSnapshotPromise;
                }
            }
            catch (e) {
                util_1.logError(e.message);
                if (!allowStale) {
                    throw e;
                }
            }
            this.refreshSnapshotInProgress = undefined;
            this.lastSnapshotPromise = this.restClient.request({
                url: rest_client_1.clientApi(`snapshots/image/${this.id}`),
                responseType: 'arraybuffer',
            });
            this.lastSnapshotPromise.catch(() => {
                // snapshot request failed, don't use it again
                this.lastSnapshotPromise = undefined;
            });
            return this.lastSnapshotPromise;
        });
    }
    getSipOptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeDings = this.onActiveDings.getValue(), existingDing = activeDings
                .filter((ding) => !this.expiredDingIds.includes(ding.id_str))
                .slice()
                .reverse()[0], ding = existingDing || (yield this.getSipConnectionDetails());
            if (this.expiredDingIds.includes(ding.id_str)) {
                util_1.logInfo('Waiting for a new live stream to start...');
                yield util_1.delay(500);
                return this.getSipOptions();
            }
            return {
                to: ding.sip_to,
                from: ding.sip_from,
                dingId: ding.id_str,
            };
        });
    }
    getUpdatedSipOptions(expiredDingId) {
        // Got a 480 from sip session, which means it's no longer active
        this.expiredDingIds.push(expiredDingId);
        return this.getSipOptions();
    }
    createSipSession(srtpOption = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const videoSocket = dgram_1.createSocket('udp4'), audioSocket = dgram_1.createSocket('udp4'), [sipOptions, publicIpPromise, videoPort, audioPort, [tlsPort],] = yield Promise.all([
                this.getSipOptions(),
                rtp_utils_1.getPublicIp(),
                rtp_utils_1.bindToPort(videoSocket, { forExternalUse: true }),
                rtp_utils_1.bindToPort(audioSocket, { forExternalUse: true }),
                rtp_utils_1.reservePorts(),
            ]), rtpOptions = {
                address: yield publicIpPromise,
                audio: Object.assign({ port: audioPort }, srtpOption.audio),
                video: Object.assign({ port: videoPort }, srtpOption.video),
            };
            return new sip_session_1.SipSession(sipOptions, rtpOptions, videoSocket, audioSocket, tlsPort, this);
        });
    }
    recordToFile(outputPath, duration = 30) {
        return __awaiter(this, void 0, void 0, function* () {
            const sipSession = yield this.streamVideo({
                output: ['-t', duration.toString(), outputPath],
            });
            yield sipSession.onCallEnded.pipe(operators_1.take(1)).toPromise();
        });
    }
    streamVideo(ffmpegOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            // SOMEDAY: generate random SRTP key/salt
            const sipSession = yield this.createSipSession();
            yield sipSession.start(ffmpegOptions);
            return sipSession;
        });
    }
    subscribeToDingEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('subscribe'),
        });
    }
    unsubscribeFromDingEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('unsubscribe'),
        });
    }
    subscribeToMotionEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('motions_subscribe'),
        });
    }
    unsubscribeFromMotionEvents() {
        return this.restClient.request({
            method: 'POST',
            url: this.doorbotUrl('motions_unsubscribe'),
        });
    }
}
exports.RingCamera = RingCamera;
// SOMEDAY: extract image from video file?
// ffmpeg -i input.mp4 -r 1 -f image2 image-%2d.png
