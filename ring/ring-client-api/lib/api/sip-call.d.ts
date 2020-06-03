import { Subject } from 'rxjs';
import { RtpOptions } from './rtp-utils';
export declare const expiredDingError: Error;
interface UriOptions {
    name?: string;
    uri: string;
    params?: {
        tag?: string;
    };
}
interface SipHeaders {
    [name: string]: string | any;
    cseq: {
        seq: number;
        method: string;
    };
    to: UriOptions;
    from: UriOptions;
    contact?: UriOptions[];
    via?: UriOptions[];
}
export interface SipRequest {
    uri: UriOptions | string;
    method: string;
    headers: SipHeaders;
    content: string;
}
export interface SipResponse {
    status: number;
    reason: string;
    headers: SipHeaders;
    content: string;
}
export interface SipClient {
    send: (request: SipRequest | SipResponse, handler?: (response: SipResponse) => void) => void;
    destroy: () => void;
    makeResponse: (response: SipRequest, status: number, method: string) => SipResponse;
}
export interface SipOptions {
    to: string;
    from: string;
    dingId: string;
}
export declare class SipCall {
    private sipOptions;
    private seq;
    private fromParams;
    private toParams;
    private callId;
    private sipClient;
    readonly onEndedByRemote: Subject<unknown>;
    readonly onRemoteRtpOptionsSubject: Subject<RtpOptions>;
    private destroyed;
    readonly sdp: string;
    constructor(sipOptions: SipOptions, rtpOptions: RtpOptions, tlsPort: number);
    request({ method, headers, content, seq, }: {
        method: string;
        headers?: Partial<SipHeaders>;
        content?: string;
        seq?: number;
    }): Promise<SipResponse>;
    private ackWithInfo;
    invite(): Promise<RtpOptions>;
    sendBye(): Promise<void | SipResponse>;
    destroy(): void;
}
export {};
