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
Object.defineProperty(exports, "__esModule", { value: true });
const dgram_1 = require("dgram");
const public_ip_1 = require("public-ip");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const crypto_1 = require("crypto");
const get_port_1 = __importDefault(require("get-port"));
const execa_1 = __importDefault(require("execa"));
const util_1 = require("./util");
const stun = require('stun'), portControl = require('nat-puncher');
let preferredExternalPorts, ffmpegPath;
function setPreferredExternalPorts(start, end) {
    const count = end - start + 1;
    preferredExternalPorts = Array.from(new Array(count)).map((_, i) => i + start);
}
exports.setPreferredExternalPorts = setPreferredExternalPorts;
function setFfmpegPath(path) {
    ffmpegPath = path;
}
exports.setFfmpegPath = setFfmpegPath;
function getFfmpegPath() {
    return ffmpegPath || 'ffmpeg';
}
exports.getFfmpegPath = getFfmpegPath;
function getPublicIpViaStun() {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield stun.request('stun.l.google.com:19302');
        return response.getXorAddress().address;
    });
}
exports.getPublicIpViaStun = getPublicIpViaStun;
function getPublicIp() {
    return public_ip_1.v4()
        .catch(() => getPublicIpViaStun())
        .catch(() => {
        throw new Error('Failed to retrieve public ip address');
    });
}
exports.getPublicIp = getPublicIp;
let reservedPorts = [];
function releasePorts(ports) {
    reservedPorts = reservedPorts.filter((p) => !ports.includes(p));
}
exports.releasePorts = releasePorts;
// Need to reserve ports in sequence because ffmpeg uses the next port up by default.  If it's taken, ffmpeg will error
// These "buffer" ports are internal only, so they don't need to stay within "preferred external ports"
function reservePorts({ count = 1, forExternalUse = false, attemptedPorts = [], } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const availablePorts = forExternalUse && preferredExternalPorts
            ? preferredExternalPorts.filter((p) => !reservedPorts.includes(p))
            : undefined, port = yield get_port_1.default({ port: availablePorts }), ports = [port], tryAgain = () => {
            return reservePorts({
                count,
                forExternalUse,
                attemptedPorts: attemptedPorts.concat(ports),
            });
        };
        if (reservedPorts.includes(port)) {
            // this avoids race conditions where we can reserve the same port twice
            return tryAgain();
        }
        if (availablePorts && !availablePorts.includes(port)) {
            util_1.logError('Preferred external ports depleted!  Falling back to random external port.  Consider expanding the range specified in your externalPorts config');
        }
        for (let i = 1; i < count; i++) {
            const targetConsecutivePort = port + i, openPort = yield get_port_1.default({ port: targetConsecutivePort });
            if (openPort !== targetConsecutivePort) {
                // can't reserve next port, bail and get another set
                return tryAgain();
            }
            ports.push(openPort);
        }
        if (ports.some((p) => reservedPorts.includes(p))) {
            return tryAgain();
        }
        reservedPorts.push(...ports);
        return ports;
    });
}
exports.reservePorts = reservePorts;
function isRtpMessage(message) {
    const payloadType = message.readUInt8(1) & 0x7f;
    return payloadType > 90 || payloadType === 0;
}
function getSsrc(message) {
    try {
        const isRtp = isRtpMessage(message);
        return message.readUInt32BE(isRtp ? 8 : 4);
    }
    catch (_) {
        return null;
    }
}
exports.getSsrc = getSsrc;
function generateSsrc() {
    const ssrcSource = crypto_1.randomBytes(4);
    ssrcSource[0] = 0;
    return ssrcSource.readInt32BE(0);
}
exports.generateSsrc = generateSsrc;
function getSrtpValue({ srtpKey, srtpSalt }) {
    if (!srtpKey || !srtpSalt) {
        return '';
    }
    return Buffer.concat([srtpKey, srtpSalt]).toString('base64');
}
exports.getSrtpValue = getSrtpValue;
function bindToPort(socket, { forExternalUse = false } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const [desiredPort] = yield reservePorts({ forExternalUse });
        return new Promise((resolve, reject) => {
            socket.on('error', reject);
            // 0 means select a random open port
            socket.bind(desiredPort, () => {
                const { port } = socket.address();
                resolve(port);
            });
        });
    });
}
exports.bindToPort = bindToPort;
function sendUdpHolePunch(socket, localPort, remotePort, remoteAddress, lifetimeSeconds) {
    socket.send(Buffer.alloc(8), remotePort, remoteAddress);
    portControl.addMapping(localPort, localPort, lifetimeSeconds);
}
exports.sendUdpHolePunch = sendUdpHolePunch;
function bindProxyPorts(remotePort, remoteAddress, type, sipSession) {
    return __awaiter(this, void 0, void 0, function* () {
        let ringRtpOptions;
        const onSsrc = new rxjs_1.ReplaySubject(1), socket = dgram_1.createSocket('udp4'), rtpStream = type === 'audio' ? sipSession.audioStream : sipSession.videoStream, subscriptions = [
            sipSession.onRemoteRtpOptions.subscribe((rtpOptions) => {
                ringRtpOptions = rtpOptions;
            }),
            rtpStream.onRtpPacket.subscribe(({ message }) => {
                socket.send(message, remotePort, remoteAddress);
            }),
            rtpStream.onRtpPacket
                .pipe(operators_1.map(({ message }) => getSsrc(message)), operators_1.filter((x) => x !== null), operators_1.take(1))
                .subscribe((ssrc) => ssrc && onSsrc.next(ssrc)),
        ];
        socket.on('message', (message) => {
            if (ringRtpOptions) {
                rtpStream.socket.send(message, ringRtpOptions[type].port, ringRtpOptions.address);
            }
        });
        const localPort = yield bindToPort(socket);
        sipSession.reservedPorts.push(localPort);
        sipSession.onCallEnded.subscribe(() => {
            socket.close();
            subscriptions.forEach((subscription) => subscription.unsubscribe());
        });
        return {
            ssrcPromise: onSsrc.pipe(operators_1.take(1)).toPromise(),
            localPort,
        };
    });
}
exports.bindProxyPorts = bindProxyPorts;
function doesFfmpegSupportCodec(codec) {
    return __awaiter(this, void 0, void 0, function* () {
        const output = yield execa_1.default(getFfmpegPath(), ['-codecs']);
        return output.stdout.includes(codec);
    });
}
exports.doesFfmpegSupportCodec = doesFfmpegSupportCodec;
