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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const util_1 = require("./util");
const querystring = __importStar(require("querystring"));
const rxjs_1 = require("rxjs");
const ringErrorCodes = {
    7050: 'NO_ASSET',
    7019: 'ASSET_OFFLINE',
    7061: 'ASSET_CELL_BACKUP',
    7062: 'UPDATING',
    7063: 'MAINTENANCE',
}, clientApiBaseUrl = 'https://api.ring.com/clients_api/', appApiBaseUrl = 'https://app.ring.com/api/v1/', apiVersion = 11, hardwareIdPromise = util_1.getHardwareId();
function clientApi(path) {
    return clientApiBaseUrl + path;
}
exports.clientApi = clientApi;
function appApi(path) {
    return appApiBaseUrl + path;
}
exports.appApi = appApi;
function requestWithRetry(options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { data, headers } = yield axios_1.default(options);
            if (typeof data === 'object' && headers.date) {
                data.responseTimestamp = new Date(headers.date).getTime();
            }
            return data;
        }
        catch (e) {
            if (!e.response) {
                util_1.logError(`Failed to reach Ring server at ${options.url}.  Trying again in 5 seconds...`);
                yield util_1.delay(5000);
                return requestWithRetry(options);
            }
            throw e;
        }
    });
}
class RingRestClient {
    constructor(authOptions) {
        this.authOptions = authOptions;
        // prettier-ignore
        this.refreshToken = ('refreshToken' in this.authOptions ? this.authOptions.refreshToken : undefined);
        this.authPromise = this.getAuth();
        this.sessionPromise = this.getSession();
        this.using2fa = false;
        this.onRefreshTokenUpdated = new rxjs_1.ReplaySubject(1);
    }
    getGrantData(twoFactorAuthCode) {
        if (this.refreshToken && !twoFactorAuthCode) {
            return {
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
            };
        }
        const { authOptions } = this;
        if ('email' in authOptions) {
            return {
                grant_type: 'password',
                password: authOptions.password,
                username: authOptions.email,
            };
        }
        throw new Error('Refresh token is not valid.  Unable to authenticate with Ring servers.  See https://github.com/dgreif/ring/wiki/Refresh-Tokens');
    }
    getAuth(twoFactorAuthCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const grantData = this.getGrantData(twoFactorAuthCode);
            try {
                const response = yield requestWithRetry({
                    url: 'https://oauth.ring.com/oauth/token',
                    data: Object.assign({ client_id: 'ring_official_android', scope: 'client' }, grantData),
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        '2fa-support': 'true',
                        '2fa-code': twoFactorAuthCode || '',
                        hardware_id: yield hardwareIdPromise,
                    },
                });
                this.onRefreshTokenUpdated.next({
                    oldRefreshToken: this.refreshToken,
                    newRefreshToken: response.refresh_token,
                });
                this.refreshToken = response.refresh_token;
                return response;
            }
            catch (requestError) {
                if (grantData.refresh_token) {
                    // failed request with refresh token, try again with username/password
                    this.refreshToken = undefined;
                    return this.getAuth();
                }
                const response = requestError.response || {}, responseData = response.data || {}, responseError = typeof responseData.error === 'string' ? responseData.error : '';
                if (response.status === 412 || // need 2fa code
                    (response.status === 400 &&
                        responseError.startsWith('Verification Code')) // invalid 2fa code entered
                ) {
                    this.using2fa = true;
                    throw new Error('Your Ring account is configured to use 2-factor authentication (2fa).  See https://github.com/dgreif/ring/wiki/Refresh-Tokens for details.');
                }
                const authTypeMessage = 'refreshToken' in this.authOptions
                    ? 'refresh token is'
                    : 'email and password are', errorMessage = 'Failed to fetch oauth token from Ring. ' +
                    (responseData.err_msg === 'too many requests from dependency service'
                        ? 'You have requested too many 2fa codes.  Ring limits 2fa to 10 codes within 10 minutes.  Please try again in 10 minutes.'
                        : `Verify that your ${authTypeMessage} correct.`) +
                    ` (error: ${responseError})`;
                util_1.logError(requestError.response || requestError);
                util_1.logError(errorMessage);
                throw new Error(errorMessage);
            }
        });
    }
    fetchNewSession(authToken) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return requestWithRetry({
                url: clientApi('session'),
                data: {
                    device: {
                        hardware_id: yield hardwareIdPromise,
                        metadata: {
                            api_version: apiVersion,
                            device_model: (_a = this.authOptions.controlCenterDisplayName) !== null && _a !== void 0 ? _a : 'ring-client-api',
                        },
                        os: 'android',
                    },
                },
                method: 'POST',
                headers: {
                    authorization: `Bearer ${authToken.access_token}`,
                    'content-type': 'application/json',
                },
            });
        });
    }
    getSession() {
        return this.authPromise.then((authToken) => __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.fetchNewSession(authToken);
            }
            catch (e) {
                const response = e.response || {};
                if (response.status === 401) {
                    this.refreshAuth();
                    return this.getSession();
                }
                if (response.status === 429) {
                    const retryAfter = e.response.headers['retry-after'], waitSeconds = isNaN(retryAfter)
                        ? 200
                        : Number.parseInt(retryAfter, 10);
                    util_1.logError(`Session response rate limited. Waiting to retry after ${waitSeconds} seconds`);
                    yield util_1.delay((waitSeconds + 1) * 1000);
                    util_1.logInfo('Retrying session request');
                    return this.getSession();
                }
                throw e;
            }
        }));
    }
    refreshAuth() {
        this.authPromise = this.getAuth();
    }
    refreshSession() {
        this.sessionPromise = this.getSession();
    }
    request(options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const { method, url, data, json, responseType } = options, hardwareId = yield hardwareIdPromise;
            try {
                yield this.sessionPromise;
                const authTokenResponse = yield this.authPromise, headers = {
                    'content-type': json
                        ? 'application/json'
                        : 'application/x-www-form-urlencoded',
                    authorization: `Bearer ${authTokenResponse.access_token}`,
                    hardware_id: hardwareId,
                };
                return yield requestWithRetry({
                    method: method || 'GET',
                    url,
                    data: json ? data : querystring.stringify(data),
                    headers,
                    responseType,
                });
            }
            catch (e) {
                const response = e.response || {};
                if (response.status === 401) {
                    this.refreshAuth();
                    return this.request(options);
                }
                if (response.status === 404 &&
                    response.data &&
                    Array.isArray(response.data.errors)) {
                    const errors = response.data.errors, errorText = errors
                        .map((code) => ringErrorCodes[code])
                        .filter((x) => x)
                        .join(', ');
                    if (errorText) {
                        util_1.logError(`http request failed.  ${url} returned errors: (${errorText}).  Trying again in 20 seconds`);
                        yield util_1.delay(20000);
                        return this.request(options);
                    }
                    util_1.logError(`http request failed.  ${url} returned unknown errors: (${util_1.stringify(errors)}).`);
                }
                if (response.status === 404 && url.startsWith(clientApiBaseUrl)) {
                    util_1.logError('404 from endpoint ' + url);
                    if ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.includes(hardwareId)) {
                        util_1.logError('Session hardware_id not found.  Creating a new session and trying again.');
                        this.refreshSession();
                        return this.request(options);
                    }
                    throw new Error('Not found with response: ' + util_1.stringify(response.data));
                }
                util_1.logError(`Request to ${url} failed with status ${response.status}. Response body: ${util_1.stringify(response.data)}`);
                throw e;
            }
        });
    }
    getCurrentAuth() {
        return this.authPromise;
    }
}
exports.RingRestClient = RingRestClient;
