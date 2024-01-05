"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingDelegate = void 0;
const dgram_1 = require("dgram");
const pick_port_1 = __importDefault(require("pick-port"));
const ffmpeg_1 = require("../utils/ffmpeg");
const eufy_security_client_1 = require("eufy-security-client");
const LocalLivestreamManager_1 = require("./LocalLivestreamManager");
const SnapshotManager_1 = require("./SnapshotManager");
const Talkback_1 = require("../utils/Talkback");
const utils_1 = require("../utils/utils");
class StreamingDelegate {
    // eslint-disable-next-line max-len
    constructor(platform, device, cameraConfig, api, hap) {
        // keep track of sessions
        this.pendingSessions = new Map();
        this.ongoingSessions = new Map();
        this.timeouts = new Map();
        // eslint-disable-line @typescript-eslint/explicit-module-boundary-types
        this.log = platform.log;
        this.hap = hap;
        this.api = api;
        this.platform = platform;
        this.device = device;
        this.cameraName = device.getName();
        this.cameraConfig = cameraConfig;
        this.videoConfig = cameraConfig.videoConfig;
        this.localLivestreamManager = new LocalLivestreamManager_1.LocalLivestreamManager(this.platform, this.device, this.log);
        this.snapshotManager = new SnapshotManager_1.SnapshotManager(this.platform, this.device, this.cameraConfig, this.localLivestreamManager, this.log);
        this.api.on("shutdown" /* SHUTDOWN */, () => {
            for (const session in this.ongoingSessions) {
                this.stopStream(session);
            }
            this.localLivestreamManager.stopLocalLiveStream();
        });
    }
    setController(controller) {
        this.controller = controller;
    }
    getLivestreamManager() {
        return this.localLivestreamManager;
    }
    async handleSnapshotRequest(request, callback) {
        this.log.debug('handleSnapshotRequest');
        try {
            this.log.debug('Snapshot requested: ' + request.width + ' x ' + request.height, this.cameraName, this.videoConfig.debug);
            const snapshot = await this.snapshotManager.getSnapshotBuffer(request);
            this.log.debug('snapshot byte lenght: ' + (snapshot === null || snapshot === void 0 ? void 0 : snapshot.byteLength));
            callback(undefined, snapshot);
        }
        catch (err) {
            this.log.error(this.cameraName, err);
            callback();
        }
    }
    async prepareStream(request, callback) {
        const ipv6 = request.addressVersion === 'ipv6';
        this.log.debug(this.cameraName, `stream prepare request with session id ${request.sessionID} was received.`);
        const options = {
            type: 'udp',
            ip: ipv6 ? '::' : '0.0.0.0',
            reserveTimeout: 15,
        };
        const videoReturnPort = await (0, pick_port_1.default)(options);
        const videoSSRC = this.hap.CameraController.generateSynchronisationSource();
        const audioReturnPort = await (0, pick_port_1.default)(options);
        const audioSSRC = this.hap.CameraController.generateSynchronisationSource();
        const sessionInfo = {
            address: request.targetAddress,
            ipv6: ipv6,
            videoPort: request.video.port,
            videoReturnPort: videoReturnPort,
            videoCryptoSuite: request.video.srtpCryptoSuite,
            videoSRTP: Buffer.concat([request.video.srtp_key, request.video.srtp_salt]),
            videoSSRC: videoSSRC,
            audioPort: request.audio.port,
            audioReturnPort: audioReturnPort,
            audioCryptoSuite: request.audio.srtpCryptoSuite,
            audioSRTP: Buffer.concat([request.audio.srtp_key, request.audio.srtp_salt]),
            audioSSRC: audioSSRC,
        };
        const response = {
            video: {
                port: videoReturnPort,
                ssrc: videoSSRC,
                srtp_key: request.video.srtp_key,
                srtp_salt: request.video.srtp_salt,
            },
            audio: {
                port: audioReturnPort,
                ssrc: audioSSRC,
                srtp_key: request.audio.srtp_key,
                srtp_salt: request.audio.srtp_salt,
            },
        };
        this.pendingSessions.set(request.sessionID, sessionInfo);
        callback(undefined, response);
    }
    async startStream(request, callback) {
        var _a, _b;
        var _c;
        const sessionInfo = this.pendingSessions.get(request.sessionID);
        if (!sessionInfo) {
            this.log.error(this.cameraName, 'Error finding session information.');
            callback(new Error('Error finding session information'));
        }
        this.log.debug(this.cameraName, 'VIDEOCONFIG: ' + JSON.stringify(this.videoConfig));
        try {
            const activeSession = {};
            activeSession.socket = (0, dgram_1.createSocket)(sessionInfo.ipv6 ? 'udp6' : 'udp4');
            activeSession.socket.on('error', (err) => {
                this.log.error(this.cameraName, 'Socket error: ' + err.message);
                this.stopStream(request.sessionID);
            });
            activeSession.socket.on('message', () => {
                if (activeSession.timeout) {
                    clearTimeout(activeSession.timeout);
                }
                activeSession.timeout = setTimeout(() => {
                    var _a;
                    this.log.debug(this.cameraName, 'Device appears to be inactive. Stopping video stream.');
                    (_a = this.controller) === null || _a === void 0 ? void 0 : _a.forceStopStreamingSession(request.sessionID);
                    this.stopStream(request.sessionID);
                }, request.video.rtcp_interval * 5 * 1000);
            });
            activeSession.socket.bind(sessionInfo.videoReturnPort);
            // get streams
            const videoParams = await ffmpeg_1.FFmpegParameters.forVideo(this.videoConfig.debug);
            videoParams.setup(this.cameraConfig, request);
            videoParams.setRTPTarget(sessionInfo, request);
            const useAudio = (request.audio.codec === "OPUS" /* OPUS */
                || request.audio.codec === "AAC-eld" /* AAC_ELD */)
                && this.videoConfig.audio;
            if (!useAudio && this.videoConfig.audio) {
                this.log.warn(this.cameraName, `An unsupported audio codec (type: ${request.audio.codec}) was requested. Audio streaming will be omitted.`);
            }
            let audioParams = undefined;
            if (useAudio) {
                audioParams = await ffmpeg_1.FFmpegParameters.forAudio(this.videoConfig.debug);
                audioParams.setup(this.cameraConfig, request);
                audioParams.setRTPTarget(sessionInfo, request);
            }
            const rtsp = (0, utils_1.is_rtsp_ready)(this.device, this.cameraConfig, this.log);
            if (rtsp) {
                const url = this.device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl);
                this.platform.log.debug(this.cameraName, 'RTSP URL: ' + url);
                videoParams.setInputSource(url);
                audioParams === null || audioParams === void 0 ? void 0 : audioParams.setInputSource(url);
            }
            else {
                try {
                    const streamData = await this.localLivestreamManager.getLocalLivestream().catch((err) => {
                        throw err;
                    });
                    activeSession.cachedStreamId = streamData.id;
                    await videoParams.setInputStream(streamData.videostream);
                    await (audioParams === null || audioParams === void 0 ? void 0 : audioParams.setInputStream(streamData.audiostream));
                }
                catch (err) {
                    this.log.error((this.cameraName + ' Unable to start the livestream: ' + err));
                    callback(err);
                    this.pendingSessions.delete(request.sessionID);
                    return;
                }
            }
            const useSeparateProcesses = (_a = (_c = this.videoConfig).useSeparateProcesses) !== null && _a !== void 0 ? _a : (_c.useSeparateProcesses = false);
            const videoProcess = new ffmpeg_1.FFmpeg(`[${this.cameraName}] [Video Process]`, !useSeparateProcesses && audioParams ? [videoParams, audioParams] : videoParams, this.log);
            videoProcess.on('started', () => {
                callback();
            });
            videoProcess.on('error', (err) => {
                this.log.error(this.cameraName, 'Video process ended with error: ' + err);
                this.stopStream(request.sessionID);
            });
            activeSession.videoProcess = videoProcess;
            activeSession.videoProcess.start();
            if (useSeparateProcesses && audioParams) {
                const audioProcess = new ffmpeg_1.FFmpeg(`[${this.cameraName}] [Audio Process]`, audioParams, this.log);
                audioProcess.on('error', (err) => {
                    this.log.error(this.cameraName, 'Audio process ended with error: ' + err);
                    this.stopStream(request.sessionID);
                });
                activeSession.audioProcess = audioProcess;
                activeSession.audioProcess.start();
            }
            if (this.cameraConfig.talkback) {
                const talkbackParameters = await ffmpeg_1.FFmpegParameters.forAudio(this.videoConfig.debug);
                await talkbackParameters.setTalkbackInput(sessionInfo);
                if (this.cameraConfig.talkbackChannels) {
                    talkbackParameters.setTalkbackChannels(this.cameraConfig.talkbackChannels);
                }
                activeSession.talkbackStream = new Talkback_1.TalkbackStream(this.platform, this.device);
                activeSession.returnProcess = new ffmpeg_1.FFmpeg(`[${this.cameraName}] [Talkback Process]`, talkbackParameters, this.log);
                activeSession.returnProcess.on('error', (err) => {
                    this.log.error(this.cameraName, 'Talkback process ended with error: ' + err);
                });
                activeSession.returnProcess.start();
                (_b = activeSession.returnProcess.stdout) === null || _b === void 0 ? void 0 : _b.pipe(activeSession.talkbackStream);
            }
            // Check if the pendingSession has been stopped before it was successfully started.
            const pendingSession = this.pendingSessions.get(request.sessionID);
            // pendingSession has not been deleted. Transfer it to ongoingSessions.
            if (pendingSession) {
                this.ongoingSessions.set(request.sessionID, activeSession);
                this.pendingSessions.delete(request.sessionID);
            }
            else { // pendingSession has been deleted. Add it to ongoingSession and end it immediately.
                this.ongoingSessions.set(request.sessionID, activeSession);
                this.log.info(this.cameraName, 'pendingSession has been deleted. Add it to ongoingSession and end it immediately.');
                this.stopStream(request.sessionID);
            }
        }
        catch (err) {
            this.log.error(this.cameraName, 'Stream could not be started: ' + err);
            callback(err);
            this.pendingSessions.delete(request.sessionID);
        }
    }
    handleStreamRequest(request, callback) {
        switch (request.type) {
            case "start" /* START */:
                this.log.debug(this.cameraName, `Received request to start stream with id ${request.sessionID}`);
                this.log.debug(this.cameraName, `request data: ${JSON.stringify(request)}`);
                this.startStream(request, callback);
                break;
            case "reconfigure" /* RECONFIGURE */:
                this.log.debug(this.cameraName, 'Received request to reconfigure: ' +
                    request.video.width +
                    ' x ' +
                    request.video.height +
                    ', ' +
                    request.video.fps +
                    ' fps, ' +
                    request.video.max_bit_rate +
                    ' kbps (Ignored)', this.videoConfig.debug);
                callback();
                break;
            case "stop" /* STOP */:
                this.log.debug(this.cameraName, 'Receive Apple HK Stop request' + JSON.stringify(request));
                this.stopStream(request.sessionID);
                callback();
                break;
        }
    }
    stopStream(sessionId) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.log.debug('Stopping session with id: ' + sessionId);
        const pendingSession = this.pendingSessions.get(sessionId);
        if (pendingSession) {
            this.pendingSessions.delete(sessionId);
        }
        const session = this.ongoingSessions.get(sessionId);
        if (session) {
            if (session.timeout) {
                clearTimeout(session.timeout);
            }
            try {
                (_a = session.talkbackStream) === null || _a === void 0 ? void 0 : _a.stopTalkbackStream();
                (_c = (_b = session.returnProcess) === null || _b === void 0 ? void 0 : _b.stdout) === null || _c === void 0 ? void 0 : _c.unpipe();
                (_d = session.returnProcess) === null || _d === void 0 ? void 0 : _d.stop();
            }
            catch (err) {
                this.log.error(this.cameraName, 'Error occurred terminating returnAudio FFmpeg process: ' + err);
            }
            try {
                (_e = session.videoProcess) === null || _e === void 0 ? void 0 : _e.stop();
            }
            catch (err) {
                this.log.error(this.cameraName, 'Error occurred terminating video FFmpeg process: ' + err);
            }
            try {
                (_f = session.audioProcess) === null || _f === void 0 ? void 0 : _f.stop();
            }
            catch (err) {
                this.log.error(this.cameraName, 'Error occurred terminating audio FFmpeg process: ' + err);
            }
            try {
                (_g = session.socket) === null || _g === void 0 ? void 0 : _g.close();
            }
            catch (err) {
                this.log.error(this.cameraName, 'Error occurred closing socket: ' + err);
            }
            try {
                if (!(0, utils_1.is_rtsp_ready)(this.device, this.cameraConfig, this.log) && session.cachedStreamId) {
                    this.localLivestreamManager.stopProxyStream(session.cachedStreamId);
                }
            }
            catch (err) {
                this.log.error(this.cameraName, 'Error occurred terminating Eufy Station livestream: ' + err);
            }
            this.ongoingSessions.delete(sessionId);
            this.log.info(this.cameraName, 'Stopped video stream.');
        }
        else {
            this.log.debug('No session to stop.');
        }
    }
}
exports.StreamingDelegate = StreamingDelegate;
//# sourceMappingURL=streamingDelegate.js.map