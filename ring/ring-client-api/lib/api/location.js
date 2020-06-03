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
const socket_io_client_1 = require("socket.io-client");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const util_1 = require("./util");
const ring_types_1 = require("./ring-types");
const rest_client_1 = require("./rest-client");
const ring_camera_1 = require("./ring-camera");
const ring_device_1 = require("./ring-device");
const deviceListMessageType = 'DeviceInfoDocGetList';
function flattenDeviceData(data) {
    return Object.assign({}, data.general && data.general.v2, data.device && data.device.v1);
}
class Location {
    constructor(locationDetails, cameras, options, restClient) {
        this.locationDetails = locationDetails;
        this.cameras = cameras;
        this.options = options;
        this.restClient = restClient;
        this.seq = 1;
        this.onMessage = new rxjs_1.Subject();
        this.onDataUpdate = new rxjs_1.Subject();
        this.onDeviceDataUpdate = this.onDataUpdate.pipe(operators_1.filter((message) => {
            return message.datatype === 'DeviceInfoDocType' && Boolean(message.body);
        }), operators_1.concatMap((message) => message.body), operators_1.map(flattenDeviceData));
        this.onDeviceList = this.onMessage.pipe(operators_1.filter((m) => m.msg === deviceListMessageType));
        this.onDevices = this.onDeviceList.pipe(operators_1.scan((devices, { body: deviceList, src }) => {
            if (!deviceList) {
                return devices;
            }
            if (!this.receivedAssetDeviceLists.includes(src)) {
                this.receivedAssetDeviceLists.push(src);
            }
            return deviceList.reduce((updatedDevices, data) => {
                const flatData = flattenDeviceData(data), existingDevice = updatedDevices.find((x) => x.zid === flatData.zid);
                if (existingDevice) {
                    existingDevice.updateData(flatData);
                    return updatedDevices;
                }
                return [...updatedDevices, new ring_device_1.RingDevice(flatData, this, src)];
            }, devices);
        }, []), operators_1.distinctUntilChanged((a, b) => a.length === b.length), operators_1.filter(() => {
            return Boolean(this.assets &&
                this.assets.every((asset) => this.receivedAssetDeviceLists.includes(asset.uuid)));
        }), operators_1.publishReplay(1), operators_1.refCount());
        this.onSessionInfo = this.onDataUpdate.pipe(operators_1.filter((m) => m.msg === 'SessionInfo'), operators_1.map((m) => m.body));
        this.onConnected = new rxjs_1.BehaviorSubject(false);
        this.onLocationMode = new rxjs_1.ReplaySubject(1);
        this.onLocationModeRequested = new rxjs_1.Subject();
        this.reconnecting = false;
        this.receivedAssetDeviceLists = [];
        this.offlineAssets = [];
        this.hasHubs = this.options.hasHubs;
        this.hasAlarmBaseStation = this.options.hasAlarmBaseStation;
        // start listening for devices immediately
        this.onDevices.subscribe();
        // watch for sessions to come online
        this.onSessionInfo.subscribe((sessions) => {
            sessions.forEach(({ connectionStatus, assetUuid }) => {
                const assetWasOffline = this.offlineAssets.includes(assetUuid), asset = this.assets && this.assets.find((x) => x.uuid === assetUuid);
                if (!asset) {
                    // we don't know about this asset, so don't worry about it
                    return;
                }
                if (connectionStatus === 'online') {
                    if (assetWasOffline) {
                        this.requestList(deviceListMessageType, assetUuid);
                        this.offlineAssets = this.offlineAssets.filter((id) => id !== assetUuid);
                        util_1.logInfo(`Ring ${asset.kind} ${assetUuid} has come back online`);
                    }
                }
                else if (!assetWasOffline) {
                    util_1.logError(`Ring ${asset.kind} ${assetUuid} is offline or on cellular backup.  Waiting for status to change`);
                    this.offlineAssets.push(assetUuid);
                }
            });
        });
        if (!options.hasAlarmBaseStation && options.locationModePollingSeconds) {
            rxjs_1.merge(this.onLocationModeRequested, this.onLocationMode)
                .pipe(operators_1.debounceTime(options.locationModePollingSeconds * 1000))
                .subscribe(() => this.getLocationMode());
            void this.getLocationMode();
        }
    }
    get id() {
        return this.locationId;
    }
    get locationId() {
        return this.locationDetails.location_id;
    }
    get name() {
        return this.locationDetails.name;
    }
    createConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            util_1.logInfo('Creating location socket.io connection');
            const { assets, ticket, host } = yield this.restClient.request({
                url: rest_client_1.appApi('clap/tickets?locationID=' + this.id),
            });
            this.assets = assets;
            this.receivedAssetDeviceLists.length = 0;
            this.offlineAssets.length = 0;
            if (!assets.length) {
                const errorMessage = `No assets (alarm hubs or beam bridges) found for location ${this.name} - ${this.id}`;
                util_1.logError(errorMessage);
                throw new Error(errorMessage);
            }
            const connection = socket_io_client_1.connect(`wss://${host}/?authcode=${ticket}&ack=false&EIO=3`, { transports: ['websocket'] }), reconnect = () => {
                if (this.reconnecting && this.connectionPromise) {
                    return this.connectionPromise;
                }
                this.onConnected.next(false);
                util_1.logInfo('Reconnecting location socket.io connection');
                this.reconnecting = true;
                connection.close();
                return (this.connectionPromise = util_1.delay(1000).then(() => {
                    return this.createConnection();
                }));
            };
            this.reconnecting = false;
            connection.on('DataUpdate', (message) => {
                if (message.datatype === 'HubDisconnectionEventType') {
                    util_1.logInfo('Location connection told to reconnect');
                    return reconnect();
                }
                this.onDataUpdate.next(message);
            });
            connection.on('message', (message) => this.onMessage.next(message));
            connection.on('error', reconnect);
            connection.on('disconnect', reconnect);
            return new Promise((resolve, reject) => {
                connection.once('connect', () => {
                    resolve(connection);
                    this.onConnected.next(true);
                    util_1.logInfo('Ring connected to socket.io server');
                    assets.forEach((asset) => this.requestList(deviceListMessageType, asset.uuid));
                });
                connection.once('error', reject);
            }).catch(reconnect);
        });
    }
    getConnection() {
        if (!this.hasHubs) {
            return Promise.reject(new Error(`Location ${this.name} does not have any hubs`));
        }
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        return (this.connectionPromise = this.createConnection());
    }
    sendMessage(message) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield this.getConnection();
            message.seq = this.seq++;
            connection.emit('message', message);
        });
    }
    sendCommandToSecurityPanel(commandType, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const securityPanel = yield this.getSecurityPanel();
            securityPanel.sendCommand(commandType, data);
        });
    }
    setAlarmMode(alarmMode, bypassSensorZids) {
        return __awaiter(this, void 0, void 0, function* () {
            const securityPanel = yield this.getSecurityPanel(), updatedDataPromise = securityPanel.onData
                .pipe(operators_1.skip(1), operators_1.take(1))
                .toPromise();
            yield this.sendCommandToSecurityPanel('security-panel.switch-mode', {
                mode: alarmMode,
                bypass: bypassSensorZids,
            });
            const updatedData = yield updatedDataPromise;
            if (updatedData.mode !== alarmMode) {
                throw new Error(`Failed to set alarm mode to "${alarmMode}".  Sensors may require bypass, which can only be done in the Ring app.`);
            }
        });
    }
    getAlarmMode() {
        return __awaiter(this, void 0, void 0, function* () {
            const securityPanel = yield this.getSecurityPanel();
            return securityPanel.data.mode;
        });
    }
    soundSiren() {
        return this.sendCommandToSecurityPanel('security-panel.sound-siren');
    }
    silenceSiren() {
        return this.sendCommandToSecurityPanel('security-panel.silence-siren');
    }
    setLightGroup(groupId, on, durationSeconds = 60) {
        this.restClient.request({
            method: 'POST',
            url: `https://api.ring.com/groups/v1/locations/${this.id}/groups/${groupId}/devices`,
            data: {
                lights_on: {
                    duration_seconds: durationSeconds,
                    enabled: on,
                },
            },
            json: true,
        });
    }
    getNextMessageOfType(type, src) {
        return this.onMessage
            .pipe(operators_1.filter((m) => m.msg === type && m.src === src), operators_1.map((m) => m.body), operators_1.take(1))
            .toPromise();
    }
    requestList(listType, assetId) {
        this.sendMessage({ msg: listType, dst: assetId });
    }
    getList(listType, assetId) {
        this.requestList(listType, assetId);
        return this.getNextMessageOfType(listType, assetId);
    }
    getDevices() {
        if (!this.hasHubs) {
            return [];
        }
        if (!this.connectionPromise) {
            this.getConnection();
        }
        return this.onDevices.pipe(operators_1.take(1)).toPromise();
    }
    getRoomList(assetId) {
        return this.getList('RoomGetList', assetId);
    }
    getSecurityPanel() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.securityPanel) {
                return this.securityPanel;
            }
            const devices = yield this.getDevices(), securityPanel = devices.find((device) => {
                return device.data.deviceType === ring_types_1.RingDeviceType.SecurityPanel;
            });
            if (!securityPanel) {
                throw new Error(`Could not find a security panel for location ${this.name} - ${this.id}`);
            }
            return (this.securityPanel = securityPanel);
        });
    }
    disarm() {
        return this.setAlarmMode('none');
    }
    armHome(bypassSensorZids) {
        return this.setAlarmMode('some', bypassSensorZids);
    }
    armAway(bypassSensorZids) {
        return this.setAlarmMode('all', bypassSensorZids);
    }
    getHistory(options = {}) {
        options.maxLevel = options.maxLevel || 50;
        return this.restClient.request({
            url: rest_client_1.appApi(`rs/history${ring_camera_1.getSearchQueryString(Object.assign({ accountId: this.id }, options))}`),
        });
    }
    getCameraEvents(options = {}) {
        return this.restClient.request({
            url: rest_client_1.clientApi(`locations/${this.id}/events${ring_camera_1.getSearchQueryString(options)}`),
        });
    }
    getAccountMonitoringStatus() {
        return this.restClient.request({
            url: rest_client_1.appApi('rs/monitoring/accounts/' + this.id),
        });
    }
    triggerAlarm(signalType) {
        const now = Date.now(), alarmSessionUuid = util_1.generateUuid(), baseStationAsset = this.assets && this.assets.find((x) => x.kind === 'base_station_v1');
        if (!baseStationAsset) {
            throw new Error('Cannot dispatch panic events without an alarm base station');
        }
        return this.restClient.request({
            method: 'POST',
            url: rest_client_1.appApi(`rs/monitoring/accounts/${this.id}/assets/${baseStationAsset.uuid}/userAlarm`),
            json: true,
            data: {
                alarmSessionUuid,
                currentTsMs: now,
                eventOccurredTime: now,
                signalType,
            },
        });
    }
    triggerBurglarAlarm() {
        return this.triggerAlarm(ring_types_1.DispatchSignalType.Burglar);
    }
    triggerFireAlarm() {
        return this.triggerAlarm(ring_types_1.DispatchSignalType.Fire);
    }
    getLocationMode() {
        return __awaiter(this, void 0, void 0, function* () {
            this.onLocationModeRequested.next();
            const response = yield this.restClient.request({
                method: 'GET',
                url: rest_client_1.appApi(`mode/location/${this.id}`),
            });
            this.onLocationMode.next(response.mode);
            return response;
        });
    }
    setLocationMode(mode) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.restClient.request({
                method: 'POST',
                url: rest_client_1.appApi(`mode/location/${this.id}`),
                json: true,
                data: { mode },
            });
            this.onLocationMode.next(response.mode);
            return response;
        });
    }
    disableLocationModes() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.restClient.request({
                method: 'DELETE',
                url: rest_client_1.appApi(`mode/location/${this.id}/settings`),
            });
            this.onLocationMode.next('disabled');
        });
    }
    getLocationModeSettings() {
        return this.restClient.request({
            method: 'GET',
            url: rest_client_1.appApi(`mode/location/${this.id}/settings`),
        });
    }
    setLocationModeSettings(settings) {
        return this.restClient.request({
            method: 'POST',
            url: rest_client_1.appApi(`mode/location/${this.id}/settings`),
            data: settings,
        });
    }
    getLocationModeSharing() {
        return this.restClient.request({
            method: 'GET',
            url: rest_client_1.appApi(`mode/location/${this.id}/sharing`),
        });
    }
    setLocationModeSharing(sharedUsersEnabled) {
        return this.restClient.request({
            method: 'POST',
            url: rest_client_1.appApi(`mode/location/${this.id}/sharing`),
            json: true,
            data: { sharedUsersEnabled },
        });
    }
    supportsLocationModeSwitching() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hasAlarmBaseStation || !this.cameras.length) {
                return false;
            }
            const modeResponse = yield this.getLocationMode(), { mode, readOnly, notYetParticipatingInMode } = modeResponse;
            util_1.logDebug('Location Mode: ' + JSON.stringify(modeResponse));
            return (!readOnly &&
                !(notYetParticipatingInMode === null || notYetParticipatingInMode === void 0 ? void 0 : notYetParticipatingInMode.length) &&
                !ring_types_1.disabledLocationModes.includes(mode));
        });
    }
}
exports.Location = Location;
