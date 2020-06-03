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
const rest_client_1 = require("./rest-client");
const location_1 = require("./location");
const ring_camera_1 = require("./ring-camera");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const util_1 = require("./util");
const rtp_utils_1 = require("./rtp-utils");
class RingApi {
    constructor(options) {
        this.options = options;
        this.restClient = new rest_client_1.RingRestClient(this.options);
        this.onRefreshTokenUpdated = this.restClient.onRefreshTokenUpdated.asObservable();
        this.locations = this.fetchAndBuildLocations();
        if (options.debug) {
            util_1.enableDebug();
        }
        const { externalPorts, ffmpegPath } = options;
        if (typeof externalPorts === 'object') {
            const { start, end } = externalPorts, portConfigIssues = [];
            if (!start || !end) {
                portConfigIssues.push('start and end must both be defined');
            }
            if (start >= end) {
                portConfigIssues.push('start must be larger than end');
            }
            if (start < 1024) {
                portConfigIssues.push('start must be larger than 1024, preferably larger than 10000 to avoid conflicts');
            }
            if (end > 65535) {
                portConfigIssues.push('end must be smaller than 65536');
            }
            if (portConfigIssues.length) {
                throw new Error('Invalid externalPorts config: ' + portConfigIssues.join('; '));
            }
            rtp_utils_1.setPreferredExternalPorts(start, end);
        }
        if (ffmpegPath) {
            rtp_utils_1.setFfmpegPath(ffmpegPath);
        }
    }
    fetchRingDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            const { doorbots, authorized_doorbots: authorizedDoorbots, stickup_cams: stickupCams, base_stations: baseStations, beams_bridges: beamBridges, } = yield this.restClient.request({ url: rest_client_1.clientApi('ring_devices') });
            return {
                doorbots,
                authorizedDoorbots,
                stickupCams,
                allCameras: doorbots.concat(stickupCams, authorizedDoorbots),
                baseStations,
                beamBridges,
            };
        });
    }
    fetchActiveDings() {
        return this.restClient.request({
            url: rest_client_1.clientApi('dings/active'),
        });
    }
    listenForCameraUpdates(cameras) {
        const { cameraStatusPollingSeconds, cameraDingsPollingSeconds, } = this.options, onCamerasRequestUpdate = rxjs_1.merge(...cameras.map((camera) => camera.onRequestUpdate)), onCamerasRequestActiveDings = rxjs_1.merge(...cameras.map((camera) => camera.onRequestActiveDings)), onUpdateReceived = new rxjs_1.Subject(), onActiveDingsReceived = new rxjs_1.Subject(), onPollForStatusUpdate = cameraStatusPollingSeconds
            ? onUpdateReceived.pipe(operators_1.debounceTime(cameraStatusPollingSeconds * 1000))
            : rxjs_1.EMPTY, onPollForActiveDings = cameraDingsPollingSeconds
            ? onActiveDingsReceived.pipe(operators_1.debounceTime(cameraDingsPollingSeconds * 1000))
            : rxjs_1.EMPTY, camerasById = cameras.reduce((byId, camera) => {
            byId[camera.id] = camera;
            return byId;
        }, {});
        if (!cameras.length) {
            return;
        }
        rxjs_1.merge(onCamerasRequestUpdate, onPollForStatusUpdate)
            .pipe(operators_1.throttleTime(500), operators_1.switchMap(() => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.fetchRingDevices().catch(() => null);
            return response && response.allCameras;
        })))
            .subscribe((cameraData) => {
            onUpdateReceived.next();
            if (!cameraData) {
                return;
            }
            cameraData.forEach((data) => {
                const camera = camerasById[data.id];
                if (camera) {
                    camera.updateData(data);
                }
            });
        });
        if (cameraStatusPollingSeconds) {
            onUpdateReceived.next(); // kick off polling
        }
        rxjs_1.merge(onCamerasRequestActiveDings, onPollForActiveDings).subscribe(() => __awaiter(this, void 0, void 0, function* () {
            const activeDings = yield this.fetchActiveDings().catch(() => null);
            onActiveDingsReceived.next();
            if (!activeDings || !activeDings.length) {
                return;
            }
            activeDings.forEach((activeDing) => {
                const camera = camerasById[activeDing.doorbot_id];
                if (camera) {
                    camera.processActiveDing(activeDing);
                }
            });
        }));
        if (cameraDingsPollingSeconds) {
            onActiveDingsReceived.next(); // kick off polling
        }
    }
    fetchRawLocations() {
        return __awaiter(this, void 0, void 0, function* () {
            const { user_locations: rawLocations } = yield this.restClient.request({ url: 'https://app.ring.com/rhq/v1/devices/v1/locations' });
            return rawLocations;
        });
    }
    fetchAndBuildLocations() {
        return __awaiter(this, void 0, void 0, function* () {
            const rawLocations = yield this.fetchRawLocations(), { authorizedDoorbots, doorbots, allCameras, baseStations, beamBridges, } = yield this.fetchRingDevices(), locationIdsWithHubs = [...baseStations, ...beamBridges].map((x) => x.location_id), cameras = allCameras.map((data) => new ring_camera_1.RingCamera(data, doorbots.includes(data) || authorizedDoorbots.includes(data), this.restClient)), locations = rawLocations
                .filter((location) => {
                return (!Array.isArray(this.options.locationIds) ||
                    this.options.locationIds.includes(location.location_id));
            })
                .map((location) => new location_1.Location(location, cameras.filter((x) => x.data.location_id === location.location_id), {
                hasHubs: locationIdsWithHubs.includes(location.location_id),
                hasAlarmBaseStation: baseStations.some((station) => station.location_id === location.location_id),
                locationModePollingSeconds: this.options
                    .locationModePollingSeconds,
            }, this.restClient));
            this.listenForCameraUpdates(cameras);
            return locations;
        });
    }
    getLocations() {
        return this.locations;
    }
    getCameras() {
        return __awaiter(this, void 0, void 0, function* () {
            const locations = yield this.locations;
            return locations.reduce((cameras, location) => [...cameras, ...location.cameras], []);
        });
    }
}
exports.RingApi = RingApi;
