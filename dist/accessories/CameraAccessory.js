"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CameraAccessory = void 0;
const Device_1 = require("./Device");
const eufy_security_client_1 = require("eufy-security-client");
const streamingDelegate_1 = require("../controller/streamingDelegate");
const recordingDelegate_1 = require("../controller/recordingDelegate");
const experimental_1 = require("../utils/experimental");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class CameraAccessory extends Device_1.DeviceAccessory {
    constructor(platform, accessory, eufyDevice, isDoorbell = false) {
        var _a, _b, _c, _d;
        super(platform, accessory, eufyDevice);
        this.streamingDelegate = null;
        this.service = {};
        this.CameraService = {};
        this.cameraConfig = {};
        this.platform.log.debug(this.accessory.displayName, 'Constructed Camera');
        this.cameraConfig = this.getCameraConfig();
        this.platform.log.debug(this.accessory.displayName, 'config is:', this.cameraConfig);
        try {
            this.service = this.motionFunction(accessory);
        }
        catch (Error) {
            this.platform.log.error(this.accessory.displayName, 'raise error to check and attach motion function.', Error);
        }
        if (this.cameraConfig.enableCamera || (typeof this.eufyDevice.isDoorbell === 'function' && this.eufyDevice.isDoorbell())) {
            this.platform.log.debug(this.accessory.displayName, 'has a camera');
            try {
                const delegate = new streamingDelegate_1.StreamingDelegate(this.platform, eufyDevice, this.cameraConfig, this.platform.api, this.platform.api.hap);
                this.streamingDelegate = delegate;
                this.recordingDelegate = new recordingDelegate_1.RecordingDelegate(this.platform, this.accessory, eufyDevice, this.cameraConfig, this.streamingDelegate.getLivestreamManager(), this.platform.log);
                let samplerate = 16 /* KHZ_16 */;
                if (((_a = this.cameraConfig.videoConfig) === null || _a === void 0 ? void 0 : _a.audioSampleRate) === 8) {
                    samplerate = 8 /* KHZ_8 */;
                }
                else if (((_b = this.cameraConfig.videoConfig) === null || _b === void 0 ? void 0 : _b.audioSampleRate) === 24) {
                    samplerate = 24 /* KHZ_24 */;
                }
                let audioCodecType = "AAC-eld" /* AAC_ELD */;
                if ((_c = this.cameraConfig.videoConfig) === null || _c === void 0 ? void 0 : _c.acodecHK) {
                    audioCodecType = this.cameraConfig.videoConfig.acodecHK;
                }
                this.platform.log.debug(this.accessory.displayName, `Audio sample rate set to ${samplerate} kHz.`);
                this.platform.log.debug(this.accessory.displayName, `Audio Codec for HK: ${audioCodecType}`);
                this.cameraControllerOptions = {
                    cameraStreamCount: ((_d = this.cameraConfig.videoConfig) === null || _d === void 0 ? void 0 : _d.maxStreams) || 2,
                    delegate: this.streamingDelegate,
                    streamingOptions: {
                        supportedCryptoSuites: [0 /* AES_CM_128_HMAC_SHA1_80 */],
                        video: {
                            resolutions: [
                                [320, 180, 30],
                                [320, 240, 15],
                                [320, 240, 30],
                                [480, 270, 30],
                                [480, 360, 30],
                                [640, 360, 30],
                                [640, 480, 30],
                                [1280, 720, 30],
                                [1280, 960, 30],
                                [1920, 1080, 30],
                                [1600, 1200, 30],
                            ],
                            codec: {
                                profiles: [
                                    0 /* BASELINE */,
                                    1 /* MAIN */,
                                    2 /* HIGH */,
                                ],
                                levels: [
                                    0 /* LEVEL3_1 */,
                                    1 /* LEVEL3_2 */,
                                    2 /* LEVEL4_0 */,
                                ],
                            },
                        },
                        audio: {
                            twoWayAudio: this.cameraConfig.talkback,
                            codecs: [
                                {
                                    type: audioCodecType,
                                    samplerate: samplerate,
                                },
                            ],
                        },
                    },
                    recording: this.cameraConfig.hsv
                        ? {
                            options: {
                                overrideEventTriggerOptions: [
                                    1 /* MOTION */,
                                    2 /* DOORBELL */,
                                ],
                                prebufferLength: 0,
                                mediaContainerConfiguration: [
                                    {
                                        type: 0 /* FRAGMENTED_MP4 */,
                                        fragmentLength: 4000,
                                    },
                                ],
                                video: {
                                    type: 0 /* H264 */,
                                    parameters: {
                                        profiles: [
                                            0 /* BASELINE */,
                                            1 /* MAIN */,
                                            2 /* HIGH */,
                                        ],
                                        levels: [
                                            0 /* LEVEL3_1 */,
                                            1 /* LEVEL3_2 */,
                                            2 /* LEVEL4_0 */,
                                        ],
                                    },
                                    resolutions: [
                                        [320, 180, 30],
                                        [320, 240, 15],
                                        [320, 240, 30],
                                        [480, 270, 30],
                                        [480, 360, 30],
                                        [640, 360, 30],
                                        [640, 480, 30],
                                        [1280, 720, 30],
                                        [1280, 960, 30],
                                        [1920, 1080, 30],
                                        [1600, 1200, 30],
                                    ],
                                },
                                audio: {
                                    codecs: {
                                        type: 1 /* AAC_ELD */,
                                        samplerate: 2 /* KHZ_24 */,
                                        bitrateMode: 0,
                                        audioChannels: 1,
                                    },
                                },
                            },
                            delegate: this.recordingDelegate,
                        }
                        : undefined,
                    sensors: this.cameraConfig.hsv
                        ? {
                            motion: this.service,
                            // eslint-disable-next-line max-len
                            // occupancy: this.accessory.getServiceById(this.platform.api.hap.Service.OccupancySensor, 'occupancy') || false, //not implemented yet
                        }
                        : undefined,
                };
                if (!isDoorbell) {
                    const controller = new this.platform.api.hap.CameraController(this.cameraControllerOptions);
                    this.streamingDelegate.setController(controller);
                    this.recordingDelegate.setController(controller);
                    accessory.configureController(controller);
                    this.cameraSetup(accessory);
                }
            }
            catch (Error) {
                this.platform.log.error(this.accessory.displayName, 'raise error to check and attach livestream function.', Error);
            }
        }
        else {
            this.platform.log.debug(this.accessory.displayName, 'has a motion sensor.');
            // remove camera operating mode service if the user has disabled the camera through the config
            const operatingModeService = accessory.getService(this.platform.api.hap.Service.CameraOperatingMode);
            if (operatingModeService) {
                this.platform.log.debug(this.accessory.displayName, 'removing CameraOperatingMode service.');
                accessory.removeService(operatingModeService);
            }
        }
        try {
            this.platform.log.debug(this.accessory.displayName, 'enableButton config:', this.cameraConfig.enableButton);
            if (this.cameraConfig.enableButton
                && this.eufyDevice.hasProperty('enabled')) {
                this.platform.log.debug(this.accessory.displayName, 'has a isEnabled, so append switchEnabledService characteristic to him.');
                const switchEnabledService = this.accessory.getService('Enabled') ||
                    this.accessory.addService(this.platform.Service.Switch, 'Enabled', 'enabled');
                switchEnabledService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName + ' Enabled');
                // switchEnabledService.setCharacteristic(
                //   this.platform.Characteristic.ConfiguredName,
                //   accessory.displayName + ' Enabled',
                // );
                switchEnabledService.getCharacteristic(this.characteristic.On)
                    .onGet(this.handleEnableGet.bind(this))
                    .onSet(this.handleEnableSet.bind(this));
            }
            else {
                // eslint-disable-next-line max-len
                this.platform.log.debug(this.accessory.displayName, 'Looks like not compatible with isEnabled or this has been disabled within configuration');
                // remove enableButton service if the user has disabled the it through the config
                const enableButtonService = accessory.getService('Enabled');
                if (enableButtonService) {
                    this.platform.log.debug(this.accessory.displayName, 'removing enableButton service.');
                    accessory.removeService(enableButtonService);
                }
            }
        }
        catch (Error) {
            this.platform.log.error(this.accessory.displayName, 'raise error to check and attach switchEnabledService.', Error);
        }
        try {
            this.platform.log.debug(this.accessory.displayName, 'motionButton config:', this.cameraConfig.motionButton);
            if (this.cameraConfig.motionButton && this.eufyDevice.hasProperty('motionDetection')) {
                // eslint-disable-next-line max-len
                this.platform.log.debug(this.accessory.displayName, 'has a isMotionDetectionEnabled, so append switchMotionService characteristic to him.');
                const switchMotionService = this.accessory.getService('Motion') ||
                    this.accessory.addService(this.platform.Service.Switch, 'Motion', 'motion');
                switchMotionService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName + ' Motion');
                // switchMotionService.setCharacteristic(
                //   this.platform.Characteristic.ConfiguredName,
                //   accessory.displayName + ' Motion',
                // );
                switchMotionService.getCharacteristic(this.characteristic.On)
                    .onGet(this.handleMotionOnGet.bind(this))
                    .onSet(this.handleMotionOnSet.bind(this));
            }
            else {
                // eslint-disable-next-line max-len
                this.platform.log.debug(this.accessory.displayName, 'Looks like not compatible with isMotionDetectionEnabled or this has been disabled within configuration');
                // remove enableButton service if the user has disabled the it through the config
                const motionButtonService = accessory.getService('Motion');
                if (motionButtonService) {
                    this.platform.log.debug(this.accessory.displayName, 'removing motionButton service.');
                    accessory.removeService(motionButtonService);
                }
            }
        }
        catch (Error) {
            this.platform.log.error(this.accessory.displayName, 'raise error to check and attach switchMotionService.', Error);
        }
        try {
            if (this.eufyDevice.hasProperty('light') && (typeof this.eufyDevice.isFloodLight === 'function' && this.eufyDevice.isFloodLight())) {
                this.platform.log.debug(this.accessory.displayName, 'has a DeviceLight, so append switchLightService characteristic to him.');
                const switchLightService = this.accessory.getService('Light') ||
                    this.accessory.addService(this.platform.Service.Switch, 'Light', 'light');
                switchLightService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName + ' Light');
                // switchLightService.setCharacteristic(
                //   this.platform.Characteristic.ConfiguredName,
                //   accessory.displayName + ' Light',
                // );
                switchLightService.getCharacteristic(this.characteristic.On)
                    .onGet(this.handleLightOnGet.bind(this))
                    .onSet(this.handleLightOnSet.bind(this));
            }
            else {
                this.platform.log.debug(this.accessory.displayName, 'Looks like not compatible with DeviceLight');
            }
        }
        catch (Error) {
            this.platform.log.error(this.accessory.displayName, 'raise error to check and attach switchLightService.', Error);
        }
    }
    /**
     * Handle the setting of ExperimentalMode since it can not be achieve through the constructor since getStationById is async.
     */
    async setExperimentalMode() {
        // experimental mode
        if (this.platform.config.experimentalMode && this.eufyDevice.hasProperty('experimentalModification')) {
            const value = !!this.cameraConfig.experimentalRTSP;
            const station = await this.platform.getStationById(this.eufyDevice.getStationSerial());
            this.platform.log.debug(this.accessory.displayName, `Setting experimental RTSP capabilities to: ${value}`);
            (0, experimental_1.setRTSPCapability)(station, this.eufyDevice, value);
        }
    }
    getCameraConfig() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        let config = {};
        if (typeof this.platform.config.cameras !== 'undefined') {
            // eslint-disable-next-line prefer-arrow-callback, brace-style
            const pos = this.platform.config.cameras.map(function (e) { return e.serialNumber; }).indexOf(this.eufyDevice.getSerial());
            config = { ...this.platform.config.cameras[pos] };
        }
        config.name = this.accessory.displayName;
        config.enableButton = (_a = config.enableButton) !== null && _a !== void 0 ? _a : (config.enableButton = true);
        config.motionButton = (_b = config.motionButton) !== null && _b !== void 0 ? _b : (config.motionButton = true);
        config.rtsp = (_c = config.rtsp) !== null && _c !== void 0 ? _c : (config.rtsp = false);
        config.forcerefreshsnap = (_d = config.forcerefreshsnap) !== null && _d !== void 0 ? _d : (config.forcerefreshsnap = false);
        config.videoConfig = (_e = config.videoConfig) !== null && _e !== void 0 ? _e : (config.videoConfig = {});
        config.immediateRingNotificationWithoutSnapshot = (_f = config.immediateRingNotificationWithoutSnapshot) !== null && _f !== void 0 ? _f : (config.immediateRingNotificationWithoutSnapshot = false);
        config.delayCameraSnapshot = (_g = config.delayCameraSnapshot) !== null && _g !== void 0 ? _g : (config.delayCameraSnapshot = false);
        config.hsv = (_h = config.hsv) !== null && _h !== void 0 ? _h : (config.hsv = false);
        config.hsvRecordingDuration = (_j = config.hsvRecordingDuration) !== null && _j !== void 0 ? _j : (config.hsvRecordingDuration = 90);
        config.hsvConfig = (_k = config.hsvConfig) !== null && _k !== void 0 ? _k : (config.hsvConfig = {});
        config.indoorChimeButton = (_l = config.indoorChimeButton) !== null && _l !== void 0 ? _l : (config.indoorChimeButton = false);
        config.experimentalRTSP = (_m = config.experimentalRTSP) !== null && _m !== void 0 ? _m : (config.experimentalRTSP = false);
        if (config.hsvRecordingDuration < 10) {
            this.platform.log.warn(this.accessory.displayName, 'HomeKit Secure Video recording duration is set to ' + config.hsvRecordingDuration + '. Reverting to minimum of 10 seconds.');
            config.hsvRecordingDuration = 10;
        }
        if (config.hsvRecordingDuration > 300) {
            this.platform.log.warn(this.accessory.displayName, 'HomeKit Secure Video recording duration is set to ' + config.hsvRecordingDuration +
                '. Will set it to a maximum of 5 minutes to prevent errors.');
            config.hsvRecordingDuration = 300;
        }
        if (config.hsv && !this.platform.api.versionGreaterOrEqual('1.4.0')) {
            config.hsv = false;
            this.platform.log.warn(this.accessory.displayName, 'HomeKit Secure Video is only supported by Homebridge version >1.4.0! Please update.');
        }
        if (!config.snapshotHandlingMethod) {
            config.snapshotHandlingMethod = (config.forcerefreshsnap) ? 1 : 3;
        }
        config.talkback = (_o = config.talkback) !== null && _o !== void 0 ? _o : (config.talkback = false);
        config.talkbackChannels = (_p = config.talkbackChannels) !== null && _p !== void 0 ? _p : (config.talkbackChannels = 1);
        if (config.talkback && !this.eufyDevice.hasCommand(eufy_security_client_1.CommandName.DeviceStartTalkback)) {
            this.platform.log.warn(this.accessory.displayName, 'Talkback for this device is not supported!');
            config.talkback = false;
        }
        if (config.talkback && config.rtsp) {
            this.platform.log.warn(this.accessory.displayName, 'Talkback cannot be used with rtsp option. Ignoring talkback setting.');
            config.talkback = false;
        }
        if (config.talkbackChannels !== 1 && config.talkbackChannels !== 2) {
            this.platform.log.warn(this.accessory.displayName, 'Talkback cannot be used with ' + config.talkbackChannels + '. Setting it to mono.');
            config.talkbackChannels = 1;
        }
        return config;
    }
    cameraSetup(accessory) {
        const service = accessory.getService(this.platform.Service.CameraOperatingMode) ||
            accessory.addService(this.platform.Service.CameraOperatingMode);
        service.setCharacteristic(this.characteristic.Name, accessory.displayName);
        service
            .getCharacteristic(this.characteristic.EventSnapshotsActive)
            .onGet(this.handleEventSnapshotsActiveGet.bind(this));
        service
            .getCharacteristic(this.characteristic.EventSnapshotsActive)
            .onSet(this.handleEventSnapshotsActiveSet.bind(this));
        service
            .getCharacteristic(this.characteristic.PeriodicSnapshotsActive)
            .onGet(this.handlePeriodicSnapshotsActiveGet.bind(this));
        service
            .getCharacteristic(this.characteristic.PeriodicSnapshotsActive)
            .onSet(this.handlePeriodicSnapshotsActiveSet.bind(this));
        service
            .getCharacteristic(this.characteristic.HomeKitCameraActive)
            .onGet(this.handleHomeKitCameraActiveGet.bind(this));
        service
            .getCharacteristic(this.characteristic.HomeKitCameraActive)
            .onSet(this.handleHomeKitCameraActiveSet.bind(this));
        if (this.eufyDevice.hasProperty('enabled')) {
            service
                .getCharacteristic(this.characteristic.ManuallyDisabled)
                .onGet(this.handleManuallyDisabledGet.bind(this));
        }
        if (this.eufyDevice.hasProperty('statusLed')) {
            service
                .getCharacteristic(this.characteristic.CameraOperatingModeIndicator)
                .onGet(this.handleHomeKitCameraOperatingModeIndicatorGet.bind(this))
                .onSet(this.handleHomeKitCameraOperatingModeIndicatorSet.bind(this));
        }
        if (this.eufyDevice.hasProperty('nightvision')) {
            service
                .getCharacteristic(this.characteristic.NightVision)
                .onGet(this.handleHomeKitNightVisionGet.bind(this))
                .onSet(this.handleHomeKitNightVisionSet.bind(this));
        }
        this.CameraService = service;
        this.CameraService.setPrimaryService(true);
    }
    handleEventSnapshotsActiveGet() {
        const currentValue = this.characteristic.EventSnapshotsActive.ENABLE;
        this.platform.log.debug(this.accessory.displayName, 'GET EventSnapshotsActive:', currentValue);
        return currentValue;
    }
    /**
     * Handle requests to set the "Event Snapshots Active" characteristic
     */
    handleEventSnapshotsActiveSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'Will not SET EventSnapshotsActive:', value);
    }
    handlePeriodicSnapshotsActiveGet() {
        const currentValue = this.characteristic.PeriodicSnapshotsActive.ENABLE;
        this.platform.log.debug(this.accessory.displayName, 'GET PeriodicSnapshotsActive:', currentValue);
        return currentValue;
    }
    /**
     * Handle requests to set the "Periodic Snapshots Active" characteristic
     */
    handlePeriodicSnapshotsActiveSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'Will not SET PeriodicSnapshotsActive:', value);
    }
    /**
     * Handle requests to get the current value of the "HomeKit Camera Active" characteristic
     */
    handleHomeKitCameraActiveGet() {
        const currentValue = this.characteristic.HomeKitCameraActive.ON;
        this.platform.log.debug(this.accessory.displayName, 'GET HomeKitCameraActive:', currentValue);
        return currentValue;
    }
    /**
     * Handle requests to set the "HomeKit Camera Active" characteristic
     */
    handleHomeKitCameraActiveSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'Will not SET HomeKitCameraActive:', value);
    }
    /**
     * Handle requests to get the current value of the "HomeKit Camera Active" characteristic
     */
    async handleHomeKitCameraOperatingModeIndicatorGet() {
        try {
            const currentValue = this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceStatusLed);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceStatusLed:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.debug(this.accessory.displayName, 'handleHomeKitCameraOperatingModeIndicatorGet', 'Wrong return value');
            return false;
        }
    }
    /**
     * Handle requests to set the "HomeKit Camera Active" characteristic
     */
    async handleHomeKitCameraOperatingModeIndicatorSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'SET HomeKitCameraOperatingModeIndicator:', value);
        const station = await this.platform.getStationById(this.eufyDevice.getStationSerial());
        station.setStatusLed(this.eufyDevice, value);
        this.CameraService.getCharacteristic(this.characteristic.CameraOperatingModeIndicator).updateValue(value);
    }
    /**
     * Handle requests to get the current value of the "HomeKit Camera Active" characteristic
     */
    async handleHomeKitNightVisionGet() {
        try {
            const currentValue = this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceNightvision);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceNightvision:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.debug(this.accessory.displayName, 'handleHomeKitNightVisionGet', 'Wrong return value');
            return false;
        }
    }
    /**
     * Handle requests to set the "HomeKit Camera Active" characteristic
     */
    async handleHomeKitNightVisionSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'SET handleHomeKitNightVisionSet:', value);
        const station = await this.platform.getStationById(this.eufyDevice.getStationSerial());
        station.setNightVision(this.eufyDevice, value);
        this.CameraService.getCharacteristic(this.characteristic.NightVision).updateValue(value);
    }
    motionFunction(accessory) {
        const service = this.accessory.getService(this.platform.Service.MotionSensor) ||
            this.accessory.addService(this.platform.Service.MotionSensor);
        service.setCharacteristic(this.characteristic.Name, accessory.displayName);
        service
            .getCharacteristic(this.characteristic.MotionDetected)
            .onGet(this.handleMotionDetectedGet.bind(this));
        this.eufyDevice.on('property changed', this.onPropertyChange.bind(this));
        return service;
    }
    async handleMotionDetectedGet() {
        var _a;
        try {
            let currentValue = this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceMotionDetected);
            if ((_a = this.recordingDelegate) === null || _a === void 0 ? void 0 : _a.isRecording()) {
                currentValue = true; // assume ongoing motion when HKSV is recording
                // HKSV will remove unnecessary bits of the recorded video itself when there is no more motion
                // but since eufy-security-client doesn't return a proper value for MotionDetected while
                // streaming we assume motion to be ongoing
                // otherwise the recording would almost always end prematurely
            }
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceMotionDetected:', currentValue);
            return currentValue;
        }
        catch (_b) {
            this.platform.log.debug(this.accessory.displayName, 'handleMotionDetectedGet', 'Wrong return value');
            return false;
        }
    }
    onPropertyChange(_, name, value) {
        var _a;
        const motionValues = [
            'motionDetected',
            'personDetected',
            'petDetected',
        ];
        if (motionValues.indexOf(name) !== -1) {
            const isRecording = (_a = this.recordingDelegate) === null || _a === void 0 ? void 0 : _a.isRecording();
            if (!isRecording) {
                const motionDetected = value;
                this.platform.log.debug(this.accessory.displayName, 'ON DeviceMotionDetected:', motionDetected);
                this.service
                    .getCharacteristic(this.characteristic.MotionDetected)
                    .updateValue(motionDetected);
            }
            else {
                this.platform.log.debug(this.accessory.displayName, 'ignore change of motion detected state, since HKSV is still recording.' +
                    'The recording controller will reset the motion state afterwards.');
            }
        }
    }
    async handleEnableGet() {
        try {
            const currentValue = this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceEnabled);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceEnabled:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.debug(this.accessory.displayName, 'handleEnableGet', 'Wrong return value');
            return false;
        }
    }
    async handleManuallyDisabledGet() {
        try {
            const currentValue = this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceEnabled);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceEnabled:', currentValue);
            return !currentValue;
        }
        catch (_a) {
            this.platform.log.debug(this.accessory.displayName, 'handleManuallyDisabledGet', 'Wrong return value');
            return false;
        }
    }
    async handleEnableSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'SET DeviceEnabled:', value);
        const station = await this.platform.getStationById(this.eufyDevice.getStationSerial());
        station.enableDevice(this.eufyDevice, value);
        if (this.cameraConfig.enableCamera) {
            this.CameraService.getCharacteristic(this.characteristic.ManuallyDisabled).updateValue(!value);
        }
    }
    async handleMotionOnGet() {
        try {
            const currentValue = await this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceMotionDetection);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceMotionDetection:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.debug(this.accessory.displayName, 'handleMotionOnGet', 'Wrong return value');
            return false;
        }
    }
    async handleMotionOnSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'SET DeviceMotionDetection:', value);
        const station = await this.platform.getStationById(this.eufyDevice.getStationSerial());
        station.setMotionDetection(this.eufyDevice, value);
    }
    async handleLightOnGet() {
        try {
            const currentValue = await this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceLight);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceLight:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.debug(this.accessory.displayName, 'handleLightOnGet', 'Wrong return value');
            return false;
        }
    }
    async handleLightOnSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'SET DeviceLight:', value);
        const station = await this.platform.getStationById(this.eufyDevice.getStationSerial());
        station.switchLight(this.eufyDevice, value);
    }
}
exports.CameraAccessory = CameraAccessory;
//# sourceMappingURL=CameraAccessory.js.map