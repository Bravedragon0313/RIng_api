import { RefreshTokenAuth, RingRestClient, SessionOptions } from './rest-client';
import { Location } from './location';
import { ActiveDing, BaseStation, BeamBridge, CameraData, UserLocation } from './ring-types';
import { RingCamera } from './ring-camera';
export interface RingApiOptions extends SessionOptions {
    locationIds?: string[];
    cameraStatusPollingSeconds?: number;
    cameraDingsPollingSeconds?: number;
    locationModePollingSeconds?: number;
    debug?: boolean;
    ffmpegPath?: string;
    externalPorts?: {
        start: number;
        end: number;
    };
}
export declare class RingApi {
    readonly options: RingApiOptions & RefreshTokenAuth;
    readonly restClient: RingRestClient;
    readonly onRefreshTokenUpdated: import("rxjs").Observable<{
        oldRefreshToken?: string | undefined;
        newRefreshToken: string;
    }>;
    private locations;
    constructor(options: RingApiOptions & RefreshTokenAuth);
    fetchRingDevices(): Promise<{
        doorbots: CameraData[];
        authorizedDoorbots: CameraData[];
        stickupCams: CameraData[];
        allCameras: CameraData[];
        baseStations: BaseStation[];
        beamBridges: BeamBridge[];
    }>;
    fetchActiveDings(): Promise<ActiveDing[] & import("./rest-client").ExtendedResponse>;
    private listenForCameraUpdates;
    fetchRawLocations(): Promise<UserLocation[]>;
    fetchAndBuildLocations(): Promise<Location[]>;
    getLocations(): Promise<Location[]>;
    getCameras(): Promise<RingCamera[]>;
}
