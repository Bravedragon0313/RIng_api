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
const util_1 = require("./util");
const rxjs_1 = require("rxjs");
const rtp_utils_1 = require("./rtp-utils");
const child_process_1 = require("child_process");
const sip_call_1 = require("./sip-call");
class SipSession {
    constructor(sipOptions, rtpOptions, videoSocket, audioSocket, tlsPort, camera) {
        this.sipOptions = sipOptions;
        this.rtpOptions = rtpOptions;
        this.videoSocket = videoSocket;
        this.audioSocket = audioSocket;
        this.tlsPort = tlsPort;
        this.camera = camera;
        this.hasStarted = false;
        this.hasCallEnded = false;
        this.onAudioPacket = new rxjs_1.Subject();
        this.onVideoPacket = new rxjs_1.Subject();
        this.onCallEndedSubject = new rxjs_1.ReplaySubject(1);
        this.onRemoteRtpOptionsSubject = new rxjs_1.ReplaySubject(1);
        this.subscriptions = [];
        this.sipCall = this.createSipCall(this.sipOptions);
        this.reservedPorts = [
            this.tlsPort,
            this.rtpOptions.video.port,
            this.rtpOptions.audio.port,
        ];
        this.onCallEnded = this.onCallEndedSubject.asObservable();
        this.onRemoteRtpOptions = this.onRemoteRtpOptionsSubject.asObservable();
        this.audioStream = {
            socket: this.audioSocket,
            port: this.rtpOptions.audio.port,
            onRtpPacket: this.onAudioPacket.asObservable(),
        };
        this.videoStream = {
            socket: this.videoSocket,
            port: this.rtpOptions.video.port,
            onRtpPacket: this.onVideoPacket.asObservable(),
        };
    }
    createSipCall(sipOptions) {
        if (this.sipCall) {
            this.sipCall.destroy();
        }
        const call = (this.sipCall = new sip_call_1.SipCall(sipOptions, this.rtpOptions, this.tlsPort));
        this.subscriptions.push(call.onEndedByRemote.subscribe(() => this.callEnded(false)), call.onRemoteRtpOptionsSubject.subscribe(this.onRemoteRtpOptionsSubject));
        return this.sipCall;
    }
    start(ffmpegOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.hasStarted) {
                throw new Error('SIP Session has already been started');
            }
            this.hasStarted = true;
            if (this.hasCallEnded) {
                throw new Error('SIP Session has already ended');
            }
            try {
                const remoteRtpOptions = yield this.sipCall.invite(), { address: remoteAddress } = remoteRtpOptions, keepAliveInterval = 15, portMappingLifetime = keepAliveInterval + 5, holePunch = () => {
                    rtp_utils_1.sendUdpHolePunch(this.audioSocket, this.audioStream.port, remoteRtpOptions.audio.port, remoteAddress, portMappingLifetime);
                    rtp_utils_1.sendUdpHolePunch(this.videoSocket, this.videoStream.port, remoteRtpOptions.video.port, remoteAddress, portMappingLifetime);
                };
                if (ffmpegOptions) {
                    this.startTranscoder(ffmpegOptions, remoteRtpOptions);
                }
                this.audioSocket.on('message', (message, info) => {
                    this.onAudioPacket.next({ message, info });
                });
                this.videoSocket.on('message', (message, info) => {
                    this.onVideoPacket.next({ message, info });
                });
                // punch to begin with to make sure we get through NAT
                holePunch();
                // hole punch every 15 seconds to keep stream alive and port open
                this.subscriptions.push(rxjs_1.interval(keepAliveInterval * 1000).subscribe(holePunch));
                return remoteRtpOptions;
            }
            catch (e) {
                if (e === sip_call_1.expiredDingError) {
                    const sipOptions = yield this.camera.getUpdatedSipOptions(this.sipOptions.dingId);
                    this.createSipCall(sipOptions);
                    this.hasStarted = false;
                    return this.start(ffmpegOptions);
                }
                this.callEnded(true);
                throw e;
            }
        });
    }
    startTranscoder(ffmpegOptions, remoteRtpOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const transcodeVideoStream = ffmpegOptions.video !== false, [audioPort, videoPort] = [
                yield this.reservePort(1),
                yield this.reservePort(1),
            ], input = this.sipCall.sdp
                .replace(rtp_utils_1.getSrtpValue(this.rtpOptions.audio), rtp_utils_1.getSrtpValue(remoteRtpOptions.audio))
                .replace(rtp_utils_1.getSrtpValue(this.rtpOptions.video), rtp_utils_1.getSrtpValue(remoteRtpOptions.video))
                .replace('m=audio ' + this.audioStream.port.toString(), 'm=audio ' + audioPort.toString())
                .replace('m=video ' + this.videoStream.port.toString(), 'm=video ' + videoPort.toString()), ffOptions = [
                '-hide_banner',
                '-protocol_whitelist',
                'pipe,udp,rtp,file,crypto',
                '-f',
                'sdp',
                ...(ffmpegOptions.input || []),
                '-i',
                'pipe:',
                ...(ffmpegOptions.audio || ['-acodec', 'aac']),
                ...(transcodeVideoStream
                    ? ffmpegOptions.video || ['-vcodec', 'copy']
                    : []),
                ...(ffmpegOptions.output || []),
            ], ff = child_process_1.spawn(rtp_utils_1.getFfmpegPath(), ffOptions.map((x) => x.toString()));
            ff.stderr.on('data', (data) => {
                util_1.logDebug(`ffmpeg stderr: ${data}`);
            });
            ff.on('close', (code) => {
                this.callEnded(true);
                util_1.logDebug(`ffmpeg exited with code ${code}`);
            });
            const exitHandler = () => {
                ff.stderr.pause();
                ff.stdout.pause();
                ff.kill();
                process.off('SIGINT', exitHandler);
                process.off('exit', exitHandler);
            };
            process.on('SIGINT', exitHandler);
            process.on('exit', exitHandler);
            this.onCallEnded.subscribe(exitHandler);
            ff.stdin.write(input);
            ff.stdin.end();
            const proxyPromises = [
                rtp_utils_1.bindProxyPorts(audioPort, '127.0.0.1', 'audio', this),
            ];
            if (transcodeVideoStream) {
                proxyPromises.push(rtp_utils_1.bindProxyPorts(videoPort, '127.0.0.1', 'video', this));
            }
            return Promise.all(proxyPromises);
        });
    }
    reservePort(bufferPorts = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const ports = yield rtp_utils_1.reservePorts({ count: bufferPorts + 1 });
            this.reservedPorts.push(...ports);
            return ports[0];
        });
    }
    callEnded(sendBye) {
        if (this.hasCallEnded) {
            return;
        }
        this.hasCallEnded = true;
        if (sendBye) {
            this.sipCall.sendBye();
        }
        // clean up
        this.onCallEndedSubject.next();
        this.sipCall.destroy();
        this.videoSocket.close();
        this.audioSocket.close();
        this.subscriptions.forEach((subscription) => subscription.unsubscribe());
        rtp_utils_1.releasePorts(this.reservedPorts);
    }
    stop() {
        this.callEnded(true);
    }
}
exports.SipSession = SipSession;
