/// <reference types="node" />
import { Socket } from 'dgram';
import { SipSession } from './sip-session';
export declare function setPreferredExternalPorts(start: number, end: number): void;
export declare function setFfmpegPath(path: string): void;
export declare function getFfmpegPath(): string;
export interface SrtpOptions {
    srtpKey: Buffer;
    srtpSalt: Buffer;
}
export interface RtpStreamOptions extends Partial<SrtpOptions> {
    port: number;
}
export interface RtpOptions {
    address: string;
    audio: RtpStreamOptions;
    video: RtpStreamOptions;
}
export declare function getPublicIpViaStun(): Promise<any>;
export declare function getPublicIp(): Promise<any>;
export declare function releasePorts(ports: number[]): void;
export declare function reservePorts({ count, forExternalUse, attemptedPorts, }?: {
    count?: number;
    forExternalUse?: boolean;
    attemptedPorts?: number[];
}): Promise<number[]>;
export declare function getSsrc(message: Buffer): number | null;
export declare function generateSsrc(): number;
export declare function getSrtpValue({ srtpKey, srtpSalt }: Partial<SrtpOptions>): string;
export declare function bindToPort(socket: Socket, { forExternalUse }?: {
    forExternalUse?: boolean | undefined;
}): Promise<number>;
export declare function sendUdpHolePunch(socket: Socket, localPort: number, remotePort: number, remoteAddress: string, lifetimeSeconds: number): void;
export declare function bindProxyPorts(remotePort: number, remoteAddress: string, type: 'audio' | 'video', sipSession: SipSession): Promise<{
    ssrcPromise: Promise<number>;
    localPort: number;
}>;
export declare function doesFfmpegSupportCodec(codec: string): Promise<boolean>;
