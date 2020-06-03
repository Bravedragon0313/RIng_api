/// <reference types="node" />
import { RemoteInfo, Socket } from 'dgram';
import { Observable } from 'rxjs';
import { RtpOptions } from './rtp-utils';
import { SipCall, SipOptions } from './sip-call';
import { RingCamera } from './ring-camera';
export interface RtpPacket {
    message: Buffer;
    info: RemoteInfo;
}
export interface RtpStream {
    socket: Socket;
    port: number;
    onRtpPacket: Observable<RtpPacket>;
}
declare type SpawnInput = string | number;
export interface FfmpegOptions {
    input?: SpawnInput[];
    video?: SpawnInput[] | false;
    audio?: SpawnInput[];
    output: SpawnInput[];
}
export declare class SipSession {
    private sipOptions;
    private rtpOptions;
    private videoSocket;
    private audioSocket;
    private tlsPort;
    private camera;
    private hasStarted;
    private hasCallEnded;
    private onAudioPacket;
    private onVideoPacket;
    private onCallEndedSubject;
    private onRemoteRtpOptionsSubject;
    private subscriptions;
    private sipCall;
    reservedPorts: number[];
    onCallEnded: Observable<unknown>;
    onRemoteRtpOptions: Observable<RtpOptions>;
    audioStream: RtpStream;
    videoStream: RtpStream;
    constructor(sipOptions: SipOptions, rtpOptions: RtpOptions, videoSocket: Socket, audioSocket: Socket, tlsPort: number, camera: RingCamera);
    createSipCall(sipOptions: SipOptions): SipCall;
    start(ffmpegOptions?: FfmpegOptions): Promise<RtpOptions>;
    private startTranscoder;
    reservePort(bufferPorts?: number): Promise<number>;
    private callEnded;
    stop(): void;
}
export {};
