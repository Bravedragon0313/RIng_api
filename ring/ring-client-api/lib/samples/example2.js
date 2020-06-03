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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
require("dotenv/config");
var api_1 = require("../api");
var operators_1 = require("rxjs/operators");
var fs_1 = require("fs");
var util_1 = require("util");
function example() {
    return __awaiter(this, void 0, void 0, function () {
        var env, ringApi, locations, allCameras, _loop_1, _i, locations_1, location_1, _a, locations_2, location_2, cameras, devices, _b, cameras_1, camera, _c, devices_1, device;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    env = process.env, ringApi = new api_1.RingApi({
                        // Replace with your refresh token
                        refreshToken: "eyJhbGciOiJIUzUxMiIsImprdSI6Ii9vYXV0aC9pbnRlcm5hbC9qd2tzIiwia2lkIjoiZGVmYXVsdCIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODcxMDg2MTAsInJlZnJlc2hfY2lkIjoicmluZ19vZmZpY2lhbF9hbmRyb2lkIiwicmVmcmVzaF9zY29wZXMiOlsiY2xpZW50Il0sInJlZnJlc2hfdXNlcl9pZCI6NTg3NTg2LCJybmQiOiJ2bm9Kb3E2M2JoUTNYQSIsInR5cGUiOiJyZWZyZXNoLXRva2VuIn0.uWLoPhQl0aMn1S8Yx_caxfwjrjALjX4XD3VfefFS0h4t0A2HU4BEF-bUnWLde_DQ5boNvLD9oN-48V5T_kn8gg",
                        // Listen for dings and motion events
                        cameraDingsPollingSeconds: 2
                    });
                    return [4 /*yield*/, ringApi.getLocations()];
                case 1:
                    locations = _d.sent();
                    return [4 /*yield*/, ringApi.getCameras()];
                case 2:
                    allCameras = _d.sent();
                    console.log("Found " + locations.length + " location(s) with " + allCameras.length + " camera(s).");
                    ringApi.onRefreshTokenUpdated.subscribe(function (_a) {
                        var newRefreshToken = _a.newRefreshToken, oldRefreshToken = _a.oldRefreshToken;
                        return __awaiter(_this, void 0, void 0, function () {
                            var currentConfig, updatedConfig;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        console.log('Refresh Token Updated: ', newRefreshToken);
                                        // If you are implementing a project that use `ring-client-api`, you should subscribe to onRefreshTokenUpdated and update your config each time it fires an event
                                        // Here is an example using a .env file for configuration
                                        if (!oldRefreshToken) {
                                            return [2 /*return*/];
                                        }
                                        return [4 /*yield*/, util_1.promisify(fs_1.readFile)('.env')];
                                    case 1:
                                        currentConfig = _b.sent(), updatedConfig = currentConfig
                                            .toString()
                                            .replace(oldRefreshToken, newRefreshToken);
                                        return [4 /*yield*/, util_1.promisify(fs_1.writeFile)('.env', updatedConfig)];
                                    case 2:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    });
                    _loop_1 = function (location_1) {
                        location_1.onConnected.pipe(operators_1.skip(1)).subscribe(function (connected) {
                            var status = connected ? 'Connected to' : 'Disconnected from';
                            console.log("**** " + status + " location " + location_1.name + " - " + location_1.id);
                        });
                    };
                    for (_i = 0, locations_1 = locations; _i < locations_1.length; _i++) {
                        location_1 = locations_1[_i];
                        _loop_1(location_1);
                    }
                    _a = 0, locations_2 = locations;
                    _d.label = 3;
                case 3:
                    if (!(_a < locations_2.length)) return [3 /*break*/, 6];
                    location_2 = locations_2[_a];
                    cameras = location_2.cameras;
                    return [4 /*yield*/, location_2.getDevices()];
                case 4:
                    devices = _d.sent();
                    console.log("\nLocation " + location_2.name + " has the following " + cameras.length + " camera(s):");
                    for (_b = 0, cameras_1 = cameras; _b < cameras_1.length; _b++) {
                        camera = cameras_1[_b];
                        console.log("- " + camera.id + ": " + camera.name + " (" + camera.deviceType + ")");
                    }
                    console.log("\nLocation " + location_2.name + " has the following " + devices.length + " device(s):");
                    for (_c = 0, devices_1 = devices; _c < devices_1.length; _c++) {
                        device = devices_1[_c];
                        console.log("- " + device.zid + ": " + device.name + " (" + device.deviceType + ")");
                    }
                    _d.label = 5;
                case 5:
                    _a++;
                    return [3 /*break*/, 3];
                case 6:
                    if (allCameras.length) {
                        allCameras.forEach(function (camera) {
                            camera.onNewDing.subscribe(function (ding) {
                                var event = ding.kind === 'motion'
                                    ? 'Motion detected'
                                    : ding.kind === 'ding'
                                        ? 'Doorbell pressed'
                                        : "Video started (" + ding.kind + ")";
                                console.log(event + " on " + camera.name + " camera. Ding id " + ding.id_str + ".  Received at " + new Date());
                            });
                        });
                        console.log('Listening for motion and doorbell presses on your cameras.');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
example();
