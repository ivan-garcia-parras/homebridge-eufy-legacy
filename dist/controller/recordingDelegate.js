"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingDelegate = void 0;
const eufy_security_client_1 = require("eufy-security-client");
const ffmpeg_1 = require("../utils/ffmpeg");
const utils_1 = require("../utils/utils");
const MAX_RECORDING_MINUTES = 1; // should never be used
const HKSVQuitReason = [
    'Normal',
    'Not allowed',
    'Busy',
    'Cancelled',
    'Unsupported',
    'Unexpected Failure',
    'Timeout',
    'Bad data',
    'Protocol error',
    'Invalid Configuration',
];
class RecordingDelegate {
    constructor(platform, accessory, device, cameraConfig, livestreamManager, log) {
        this.handlingStreamingRequest = false;
        this.platform = platform;
        this.log = log;
        this.accessory = accessory;
        this.camera = device;
        this.cameraConfig = cameraConfig;
        this.localLivestreamManager = livestreamManager;
    }
    setController(controller) {
        this.controller = controller;
    }
    isRecording() {
        return this.handlingStreamingRequest;
    }
    async *handleRecordingStreamRequest(streamId) {
        var _a, _b, _c, _d, _e, _f, _g;
        this.handlingStreamingRequest = true;
        this.log.info(this.camera.getName(), 'requesting recording for HomeKit Secure Video.');
        let cachedStreamId = undefined;
        let pending = [];
        let filebuffer = Buffer.alloc(0);
        try {
            // eslint-disable-next-line max-len
            const audioEnabled = (_b = (_a = this.controller) === null || _a === void 0 ? void 0 : _a.recordingManagement) === null || _b === void 0 ? void 0 : _b.recordingManagementService.getCharacteristic(this.platform.Characteristic.RecordingAudioActive).value;
            if (audioEnabled) {
                this.log.debug('HKSV and plugin are set to record audio.');
            }
            else {
                this.log.debug('HKSV and plugin are set to omit audio recording.');
            }
            const videoParams = await ffmpeg_1.FFmpegParameters.forVideoRecording();
            const audioParams = await ffmpeg_1.FFmpegParameters.forAudioRecording();
            const hsvConfig = (_c = this.cameraConfig.hsvConfig) !== null && _c !== void 0 ? _c : {};
            if (this.cameraConfig.videoConfig && this.cameraConfig.videoConfig.videoProcessor) {
                hsvConfig.videoProcessor = this.cameraConfig.videoConfig.videoProcessor;
            }
            videoParams.setupForRecording(hsvConfig, this.configuration);
            audioParams.setupForRecording(hsvConfig, this.configuration);
            const rtsp = (0, utils_1.is_rtsp_ready)(this.camera, this.cameraConfig, this.log);
            if (rtsp) {
                const url = this.camera.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl);
                this.platform.log.debug(this.camera.getName(), 'RTSP URL: ' + url);
                videoParams.setInputSource(url);
                audioParams.setInputSource(url);
            }
            else {
                const streamData = await this.localLivestreamManager.getLocalLivestream().catch((err) => {
                    throw err;
                });
                await videoParams.setInputStream(streamData.videostream);
                await audioParams.setInputStream(streamData.audiostream);
                cachedStreamId = streamData.id;
            }
            const ffmpeg = new ffmpeg_1.FFmpeg(`[${this.camera.getName()}] [HSV Recording Process]`, audioEnabled ? [videoParams, audioParams] : videoParams, this.log);
            this.session = await ffmpeg.startFragmentedMP4Session();
            let timer = (_d = this.cameraConfig.hsvRecordingDuration) !== null && _d !== void 0 ? _d : MAX_RECORDING_MINUTES * 60;
            if (this.platform.config.CameraMaxLivestreamDuration < timer) {
                timer = this.platform.config.CameraMaxLivestreamDuration;
            }
            if (timer > 0) {
                this.forceStopTimeout = setTimeout(() => {
                    var _a;
                    this.log.warn(this.camera.getName(), `The recording process has been running for ${timer} seconds and is now being forced closed!`);
                    (_a = this.accessory
                        .getService(this.platform.Service.MotionSensor)) === null || _a === void 0 ? void 0 : _a.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(false);
                }, timer * 1000);
            }
            for await (const box of this.session.generator) {
                if (!this.handlingStreamingRequest) {
                    this.log.debug(this.camera.getName(), 'Recording was ended prematurely.');
                    break;
                }
                const { header, type, data } = box;
                pending.push(header, data);
                const motionDetected = (_e = this.accessory
                    .getService(this.platform.Service.MotionSensor)) === null || _e === void 0 ? void 0 : _e.getCharacteristic(this.platform.Characteristic.MotionDetected).value;
                if (type === 'moov' || type === 'mdat') {
                    const fragment = Buffer.concat(pending);
                    filebuffer = Buffer.concat([filebuffer, Buffer.concat(pending)]);
                    pending = [];
                    yield {
                        data: fragment,
                        isLast: !motionDetected,
                    };
                    if (!motionDetected) {
                        this.log.debug(this.camera.getName(), 'Ending recording session due to motion stopped!');
                        break;
                    }
                }
            }
        }
        catch (error) {
            if (!this.handlingStreamingRequest && this.closeReason && this.closeReason === 3 /* CANCELLED */) {
                this.log.debug(this.camera.getName(), 'Recording encountered an error but that is expected, as the recording was canceled beforehand. Error: ' + error);
            }
            else {
                this.log.error(this.camera.getName(), 'Error while recording: ' + error);
            }
        }
        finally {
            if (this.closeReason &&
                this.closeReason !== 0 /* NORMAL */ && this.closeReason !== 3 /* CANCELLED */) {
                this.log.warn(this.camera.getName(), `The recording process was aborted by HSV with reason "${HKSVQuitReason[this.closeReason]}"`);
            }
            if (this.closeReason && this.closeReason === 3 /* CANCELLED */) {
                this.log.debug(this.camera.getName(), 'The recording process was canceled by the HomeKit Controller."');
            }
            if (filebuffer.length > 0) {
                this.log.debug(this.camera.getName(), 'Recording completed (HSV). Send ' + filebuffer.length + ' bytes.');
            }
            if (this.forceStopTimeout) {
                clearTimeout(this.forceStopTimeout);
                this.forceStopTimeout = undefined;
            }
            // check whether motion is still in progress
            const motionDetected = (_f = this.accessory
                .getService(this.platform.Service.MotionSensor)) === null || _f === void 0 ? void 0 : _f.getCharacteristic(this.platform.Characteristic.MotionDetected).value;
            if (motionDetected) {
                (_g = this.accessory
                    .getService(this.platform.Service.MotionSensor)) === null || _g === void 0 ? void 0 : _g.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(false);
            }
            if (cachedStreamId) {
                this.localLivestreamManager.stopProxyStream(cachedStreamId);
            }
        }
    }
    updateRecordingActive(active) {
        //this.log.debug(`Recording: ${active}`, this.accessory.displayName);
    }
    updateRecordingConfiguration(configuration) {
        this.configuration = configuration;
    }
    closeRecordingStream(streamId, reason) {
        var _a, _b, _c, _d;
        this.log.info(this.camera.getName(), 'Closing recording process');
        if (this.session) {
            this.log.debug(this.camera.getName(), 'Stopping recording session.');
            (_a = this.session.socket) === null || _a === void 0 ? void 0 : _a.destroy();
            (_b = this.session.process) === null || _b === void 0 ? void 0 : _b.kill('SIGKILL');
            this.session = undefined;
        }
        else {
            this.log.warn('Recording session could not be closed gracefully.');
        }
        if (this.forceStopTimeout) {
            clearTimeout(this.forceStopTimeout);
            this.forceStopTimeout = undefined;
        }
        // check whether motion is still in progress
        const motionDetected = (_c = this.accessory
            .getService(this.platform.Service.MotionSensor)) === null || _c === void 0 ? void 0 : _c.getCharacteristic(this.platform.Characteristic.MotionDetected).value;
        if (motionDetected) {
            (_d = this.accessory
                .getService(this.platform.Service.MotionSensor)) === null || _d === void 0 ? void 0 : _d.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(false);
        }
        this.closeReason = reason;
        this.handlingStreamingRequest = false;
    }
    acknowledgeStream(streamId) {
        this.log.debug('end of recording acknowledged!');
        this.closeRecordingStream(streamId, undefined);
    }
}
exports.RecordingDelegate = RecordingDelegate;
//# sourceMappingURL=recordingDelegate.js.map