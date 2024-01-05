"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EufySecurityPlatform = void 0;
const settings_1 = require("./settings");
const StationAccessory_1 = require("./accessories/StationAccessory");
const EntrySensorAccessory_1 = require("./accessories/EntrySensorAccessory");
const MotionSensorAccessory_1 = require("./accessories/MotionSensorAccessory");
const CameraAccessory_1 = require("./accessories/CameraAccessory");
const DoorbellCameraAccessory_1 = require("./accessories/DoorbellCameraAccessory");
const SmartLockAccessory_1 = require("./accessories/SmartLockAccessory");
const eufy_security_client_1 = require("eufy-security-client");
const bunyan_1 = __importDefault(require("bunyan"));
const bunyan_debug_stream_1 = __importDefault(require("bunyan-debug-stream"));
const tslog_1 = require("tslog");
const rfs = __importStar(require("rotating-file-stream"));
const fs_1 = __importDefault(require("fs"));
const EufyClientInteractor_1 = require("./utils/EufyClientInteractor");
const experimental_1 = require("./utils/experimental");
class EufySecurityPlatform {
    constructor(hblog, config, api) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        var _k, _l, _m, _o;
        this.hblog = hblog;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        // this is used to track restored cached accessories
        this.accessories = [];
        this.activeAccessoryIds = [];
        this.stations = [];
        this.config = config;
        this.eufyPath = this.api.user.storagePath() + '/eufysecurity';
        if (!fs_1.default.existsSync(this.eufyPath)) {
            fs_1.default.mkdirSync(this.eufyPath);
        }
        const plugin = require('../package.json');
        const omitLogFiles = (_a = this.config.omitLogFiles) !== null && _a !== void 0 ? _a : false;
        const logStreams = [{
                level: (this.config.enableDetailedLogging) ? 'debug' : 'info',
                type: 'raw',
                stream: (0, bunyan_debug_stream_1.default)({
                    forceColor: true,
                    showProcess: false,
                    showPid: false,
                    showDate: (time) => {
                        return '[' + time.toLocaleString('en-US') + ']';
                    },
                }),
            }];
        if (!omitLogFiles) {
            logStreams.push({
                level: (this.config.enableDetailedLogging) ? 'debug' : 'info',
                type: 'rotating-file',
                path: this.eufyPath + '/log-lib.log',
                period: '1d',
                count: 3, // keep 3 back copies
            });
        }
        this.log = bunyan_1.default.createLogger({
            name: '[EufySecurity-' + plugin.version + ']',
            hostname: '',
            streams: logStreams,
            serializers: bunyan_debug_stream_1.default.stdSerializers,
        });
        if (!omitLogFiles) {
            // use tslog for eufy-security-client
            const logFileNameGenerator = (index) => {
                const filename = 'eufy-log.log';
                return (index === null) ? filename : filename + '.' + (index - 1);
            };
            const eufyLogStream = rfs.createStream(logFileNameGenerator, {
                path: this.eufyPath,
                interval: '1d',
                rotate: 3,
                maxSize: '200M',
            });
            this.tsLogger = new tslog_1.Logger({ stdErr: eufyLogStream, stdOut: eufyLogStream, colorizePrettyLogs: false });
        }
        this.log.warn('warning: planned changes, see https://github.com/homebridge-eufy-security/plugin/issues/1');
        this.log.debug('plugin data store: ' + this.eufyPath);
        this.log.debug('Using bropats eufy-security-client library in version ' + eufy_security_client_1.libVersion);
        if (omitLogFiles) {
            this.log.info('log file storage will be omitted.');
        }
        this.clean_config();
        this.eufyConfig = {
            username: this.config.username,
            password: this.config.password,
            country: (_b = this.config.country) !== null && _b !== void 0 ? _b : 'US',
            trustedDeviceName: (_c = this.config.deviceName) !== null && _c !== void 0 ? _c : 'My Phone',
            language: 'en',
            persistentDir: this.eufyPath,
            p2pConnectionSetup: (this.config.preferLocalConnection) ? 1 : 2,
            pollingIntervalMinutes: (_d = this.config.pollingIntervalMinutes) !== null && _d !== void 0 ? _d : 10,
            eventDurationSeconds: 10,
        };
        this.config.ignoreStations = (_e = (_k = this.config).ignoreStations) !== null && _e !== void 0 ? _e : (_k.ignoreStations = []);
        this.config.ignoreDevices = (_f = (_l = this.config).ignoreDevices) !== null && _f !== void 0 ? _f : (_l.ignoreDevices = []);
        this.config.cleanCache = (_g = (_m = this.config).cleanCache) !== null && _g !== void 0 ? _g : (_m.cleanCache = true);
        this.log.info('Country set:', (_h = this.config.country) !== null && _h !== void 0 ? _h : 'US');
        // This function is here to avoid any break while moving from 1.0.x to 1.1.x
        // moving persistent into our dedicated folder (this need to be removed after few release of 1.1.x)
        if (fs_1.default.existsSync(this.api.user.storagePath() + '/persistent.json')) {
            this.log.debug('An old persistent file have been found');
            if (!fs_1.default.existsSync(this.eufyPath + '/persistent.json')) {
                fs_1.default.copyFileSync(this.api.user.storagePath() + '/persistent.json', this.eufyPath + '/persistent.json', fs_1.default.constants.COPYFILE_EXCL);
            }
            else {
                this.log.debug('but the new one is already present');
            }
            fs_1.default.unlinkSync(this.api.user.storagePath() + '/persistent.json');
        }
        // initialize experimental mode
        if (this.config.experimentalMode) {
            this.log.warn('Experimental Mode is enabled!');
            (0, experimental_1.initializeExperimentalMode)();
        }
        this.config.syncStationModes = (_j = (_o = this.config).syncStationModes) !== null && _j !== void 0 ? _j : (_o.syncStationModes = false);
        if (this.config.syncStationModes) {
            this.log.debug('Stations are set to sync their guard modes.');
        }
        this.api.on('didFinishLaunching', async () => {
            this.clean_config_after_init();
            await this.pluginSetup();
        });
        this.api.on('shutdown', async () => {
            await this.pluginShutdown();
        });
        this.log.info('Finished initializing!');
    }
    async pluginSetup() {
        var _a;
        try {
            this.eufyClient = (this.config.enableDetailedLogging)
                ? await eufy_security_client_1.EufySecurity.initialize(this.eufyConfig, this.tsLogger)
                : await eufy_security_client_1.EufySecurity.initialize(this.eufyConfig);
            this.eufyClient.on('tfa request', this.tfaWarning.bind(this));
            this.eufyClient.on('captcha request', this.captchaWarning.bind(this));
            this.eufyClient.on('station added', this.stationAdded.bind(this));
            this.eufyClient.on('device added', this.deviceAdded.bind(this));
            this.eufyClient.on('push connect', () => {
                this.log.debug('Push Connected!');
            });
            this.eufyClient.on('push close', () => {
                this.log.warn('Push Closed!');
            });
        }
        catch (e) {
            this.log.error('Error while setup : ', e);
            this.log.error('Not connected can\'t continue!');
            return;
        }
        try {
            await this.eufyClient.connect();
            this.log.debug('EufyClient connected ' + this.eufyClient.isConnected());
        }
        catch (e) {
            this.log.error('Error authenticating Eufy : ', e);
        }
        if (!this.eufyClient.isConnected()) {
            this.log.error('Not connected can\'t continue!');
            return;
        }
        // give the connection 45 seconds to discover all devices
        // clean old accessories after that time
        this.cleanCachedAccessoriesTimeout = setTimeout(() => {
            this.cleanCachedAccessories();
        }, 120 * 1000);
        let cameraMaxLivestreamDuration = (_a = this.config.CameraMaxLivestreamDuration) !== null && _a !== void 0 ? _a : 30;
        if (cameraMaxLivestreamDuration > 86400) {
            cameraMaxLivestreamDuration = 86400;
            // eslint-disable-next-line max-len
            this.log.warn('Your maximum livestream duration value is too large. Since this can cause problems it was reset to 86400 seconds (1 day maximum).');
        }
        this.eufyClient.setCameraMaxLivestreamDuration(cameraMaxLivestreamDuration);
        this.log.debug('CameraMaxLivestreamDuration:', this.eufyClient.getCameraMaxLivestreamDuration());
        try {
            this.pluginConfigInteractor = new EufyClientInteractor_1.EufyClientInteractor(this.eufyPath, this.log, this.eufyClient);
            await this.pluginConfigInteractor.setupServer();
        }
        catch (err) {
            this.log.warn(err);
        }
    }
    tfaWarning() {
        this.log.warn('There was a 2 Factor Authentication request while login in. ' +
            'This cannot be fulfilled by the plugin itself. Please login using the ' +
            'configuration wizard (settings) in the Homebridge UI plugins tab.');
    }
    captchaWarning(id, captcha) {
        this.log.warn('There was a Captcha request while login in. ' +
            'This cannot be fulfilled by the plugin itself. Please login using the ' +
            'configuration wizard (settings) in the Homebridge UI plugins tab.');
    }
    async stationAdded(station) {
        this.log.debug('Found Station', station.getSerial(), station.getName(), eufy_security_client_1.DeviceType[station.getDeviceType()], station.getLANIPAddress());
        if (station.getRawStation().member.member_type === 1) {
            this.log.info('You\'re using guest admin account with this plugin! This is recommanded way!');
        }
        else {
            this.log.warn('You\'re not using guest admin account with this plugin! This is not recommanded way!');
            this.log.warn('Please look here for more details:');
            this.log.warn('https://github.com/homebridge-eufy-security/plugin/wiki/Installation');
            this.log.warn(station.getSerial() + ' type: ' + station.getRawStation().member.member_type);
        }
        if (this.config.ignoreStations.indexOf(station.getSerial()) !== -1) {
            this.log.debug('Device ignored');
            return;
        }
        const deviceContainer = {
            deviceIdentifier: {
                uniqueId: station.getSerial(),
                displayName: station.getName(),
                type: station.getDeviceType(),
                station: true,
            },
            eufyDevice: station,
        };
        this.processAccessory(deviceContainer);
    }
    async deviceAdded(device) {
        this.log.debug('Found device', device.getSerial(), device.getName(), eufy_security_client_1.DeviceType[device.getDeviceType()]);
        if (this.config.ignoreDevices.indexOf(device.getSerial()) !== -1) {
            this.log.debug('Device ignored');
            return;
        }
        const deviceContainer = {
            deviceIdentifier: {
                uniqueId: device.getSerial(),
                displayName: device.getName(),
                type: device.getDeviceType(),
                station: false,
            },
            eufyDevice: device,
        };
        this.processAccessory(deviceContainer);
    }
    processAccessory(deviceContainer) {
        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address
        let uuid = this.api.hap.uuid.generate(deviceContainer.deviceIdentifier.uniqueId);
        // Checking Device Type if it's not a station, it will be the same serial number we will find
        // in Device list and it will create the same UUID
        if (deviceContainer.deviceIdentifier.type !== eufy_security_client_1.DeviceType.STATION && deviceContainer.deviceIdentifier.station) {
            uuid = this.api.hap.uuid.generate('s_' + deviceContainer.deviceIdentifier.uniqueId);
            this.log.debug('This device is not a station. Generating a new UUID to avoid any duplicate issue');
        }
        // add to active accessories (see cleanCache)
        if (this.activeAccessoryIds.indexOf(uuid) === -1) {
            this.activeAccessoryIds.push(uuid);
        }
        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const cachedAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
        if (!cachedAccessory) {
            // the accessory does not yet exist, so we need to create it
            // create a new accessory
            const accessory = new this.api.platformAccessory(deviceContainer.deviceIdentifier.displayName, uuid);
            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context['device'] = deviceContainer.deviceIdentifier;
            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            this.register_accessory(accessory, deviceContainer, false);
        }
        else {
            this.register_accessory(cachedAccessory, deviceContainer, true);
        }
    }
    async pluginShutdown() {
        if (this.cleanCachedAccessoriesTimeout) {
            clearTimeout(this.cleanCachedAccessoriesTimeout);
        }
        if (this.pluginConfigInteractor) {
            this.pluginConfigInteractor.stopServer();
        }
        try {
            this.eufyClient.close();
            this.log.info('Finished shutdown!');
        }
        catch (e) {
            this.log.error('Error while shutdown : ', e);
        }
    }
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory) {
        this.log.debug('Loading accessory from cache:', accessory.displayName);
        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }
    cleanCachedAccessories() {
        if (this.config.cleanCache) {
            this.log.info('Looking for old cached accessories that seem to be outdated...');
            let num = 0;
            const staleAccessories = this.accessories.filter((item) => {
                return this.activeAccessoryIds.indexOf(item.UUID) === -1;
            });
            staleAccessories.forEach((staleAccessory) => {
                this.log.info(`Removing cached accessory ${staleAccessory.UUID} ${staleAccessory.displayName}`);
                num++;
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [staleAccessory]);
            });
            if (num > 0) {
                this.log.info('Removed ' + num + ' cached accessories');
            }
            else {
                this.log.info('No outdated cached accessories found.');
            }
        }
    }
    register_accessory(accessory, container, exist) {
        var _a, _b;
        var _c, _d;
        this.log.debug(accessory.displayName, 'UUID:', accessory.UUID);
        let unbridge = false;
        const station = container.deviceIdentifier.station;
        let type = container.deviceIdentifier.type;
        const device = container.eufyDevice;
        /* Under development area
    
        This need to be rewrite
    
        */
        if (station) {
            if (type !== eufy_security_client_1.DeviceType.STATION) {
                // Allowing camera but not the lock nor doorbell for now
                if (!(type === eufy_security_client_1.DeviceType.LOCK_BLE
                    || type === eufy_security_client_1.DeviceType.LOCK_WIFI
                    || type === eufy_security_client_1.DeviceType.LOCK_BLE_NO_FINGER
                    || type === eufy_security_client_1.DeviceType.LOCK_WIFI_NO_FINGER
                    || type === eufy_security_client_1.DeviceType.DOORBELL
                    || type === eufy_security_client_1.DeviceType.BATTERY_DOORBELL
                    || type === eufy_security_client_1.DeviceType.BATTERY_DOORBELL_2
                    || type === eufy_security_client_1.DeviceType.BATTERY_DOORBELL_PLUS
                    || type === eufy_security_client_1.DeviceType.DOORBELL_SOLO)) {
                    // this.log.warn(accessory.displayName, 'looks station but it\'s not could imply some errors', 'Type:', type);
                    type = eufy_security_client_1.DeviceType.STATION;
                }
                else {
                    return;
                }
            }
        }
        let a;
        let tmp;
        switch (type) {
            case eufy_security_client_1.DeviceType.STATION:
            case eufy_security_client_1.DeviceType.HB3:
                tmp = new StationAccessory_1.StationAccessory(this, accessory, device);
                this.stations.push(tmp);
                break;
            case eufy_security_client_1.DeviceType.MOTION_SENSOR:
                new MotionSensorAccessory_1.MotionSensorAccessory(this, accessory, device);
                break;
            case eufy_security_client_1.DeviceType.CAMERA:
            case eufy_security_client_1.DeviceType.CAMERA2:
            case eufy_security_client_1.DeviceType.CAMERA_E:
            case eufy_security_client_1.DeviceType.CAMERA2C:
            case eufy_security_client_1.DeviceType.INDOOR_CAMERA:
            case eufy_security_client_1.DeviceType.INDOOR_PT_CAMERA:
            case eufy_security_client_1.DeviceType.INDOOR_COST_DOWN_CAMERA:
            case eufy_security_client_1.DeviceType.FLOODLIGHT:
            case eufy_security_client_1.DeviceType.CAMERA2C_PRO:
            case eufy_security_client_1.DeviceType.CAMERA2_PRO:
            case eufy_security_client_1.DeviceType.CAMERA3C:
            case eufy_security_client_1.DeviceType.CAMERA3:
            case eufy_security_client_1.DeviceType.CAMERA_GUN:
            case eufy_security_client_1.DeviceType.CAMERA_FG:
            case eufy_security_client_1.DeviceType.INDOOR_CAMERA_1080:
            case eufy_security_client_1.DeviceType.INDOOR_PT_CAMERA_1080:
            case eufy_security_client_1.DeviceType.SOLO_CAMERA:
            case eufy_security_client_1.DeviceType.SOLO_CAMERA_PRO:
            case eufy_security_client_1.DeviceType.SOLO_CAMERA_SPOTLIGHT_1080:
            case eufy_security_client_1.DeviceType.SOLO_CAMERA_SPOTLIGHT_2K:
            case eufy_security_client_1.DeviceType.SOLO_CAMERA_SPOTLIGHT_SOLAR:
            case eufy_security_client_1.DeviceType.SOLO_CAMERA_SOLAR:
            case eufy_security_client_1.DeviceType.INDOOR_OUTDOOR_CAMERA_1080P:
            case eufy_security_client_1.DeviceType.INDOOR_OUTDOOR_CAMERA_1080P_NO_LIGHT:
            case eufy_security_client_1.DeviceType.INDOOR_OUTDOOR_CAMERA_2K:
            case eufy_security_client_1.DeviceType.FLOODLIGHT_CAMERA_8422:
            case eufy_security_client_1.DeviceType.FLOODLIGHT_CAMERA_8423:
            case eufy_security_client_1.DeviceType.FLOODLIGHT_CAMERA_8424:
            case eufy_security_client_1.DeviceType.WALL_LIGHT_CAM:
            case eufy_security_client_1.DeviceType.WALL_LIGHT_CAM_81A0:
            case eufy_security_client_1.DeviceType.CAMERA_GARAGE_T8453_COMMON:
            case eufy_security_client_1.DeviceType.CAMERA_GARAGE_T8453:
            case eufy_security_client_1.DeviceType.CAMERA_GARAGE_T8452:
                a = new CameraAccessory_1.CameraAccessory(this, accessory, device);
                unbridge = (a.cameraConfig.enableCamera) ? (_a = (_c = a.cameraConfig).unbridge) !== null && _a !== void 0 ? _a : (_c.unbridge = false) : false;
                a.setExperimentalMode();
                break;
            case eufy_security_client_1.DeviceType.DOORBELL:
            case eufy_security_client_1.DeviceType.BATTERY_DOORBELL:
            case eufy_security_client_1.DeviceType.BATTERY_DOORBELL_2:
            case eufy_security_client_1.DeviceType.BATTERY_DOORBELL_PLUS:
            case eufy_security_client_1.DeviceType.DOORBELL_SOLO:
                a = new DoorbellCameraAccessory_1.DoorbellCameraAccessory(this, accessory, device);
                unbridge = (a.cameraConfig.enableCamera) ? (_b = (_d = a.cameraConfig).unbridge) !== null && _b !== void 0 ? _b : (_d.unbridge = false) : false;
                a.setExperimentalMode();
                break;
            case eufy_security_client_1.DeviceType.SENSOR:
                new EntrySensorAccessory_1.EntrySensorAccessory(this, accessory, device);
                break;
            case eufy_security_client_1.DeviceType.LOCK_BLE:
            case eufy_security_client_1.DeviceType.LOCK_WIFI:
            case eufy_security_client_1.DeviceType.LOCK_BLE_NO_FINGER:
            case eufy_security_client_1.DeviceType.LOCK_WIFI_NO_FINGER:
                new SmartLockAccessory_1.SmartLockAccessory(this, accessory, device);
                break;
            default:
                this.log.warn('This accessory is not compatible with HomeBridge Eufy Security plugin:', accessory.displayName, 'Type:', type);
                return;
        }
        if (exist) {
            if (!unbridge) {
                this.log.info('Updating accessory:', accessory.displayName);
                this.api.updatePlatformAccessories([accessory]);
                return;
            }
            else {
                this.log.info(`Removing cached accessory ${accessory.UUID} ${accessory.displayName}`);
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
            }
        }
        if (unbridge) {
            this.log.info('Adding new unbridged accessory:', accessory.displayName);
            this.api.publishExternalAccessories(settings_1.PLUGIN_NAME, [accessory]);
        }
        else {
            this.log.info('Adding new accessory:', accessory.displayName);
            this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
        }
    }
    getStationById(id) {
        return this.eufyClient.getStation(id);
    }
    getStationAccessories() {
        return this.stations;
    }
    clean_config() {
        try {
            const currentConfig = JSON.parse(fs_1.default.readFileSync(this.api.user.configPath(), 'utf8'));
            // check the platforms section is an array before we do array things on it
            if (!Array.isArray(currentConfig.platforms)) {
                throw new Error('Cannot find platforms array in config');
            }
            // find this plugins current config
            const pluginConfig = currentConfig.platforms.find((x) => x.platform === settings_1.PLATFORM_NAME);
            if (!pluginConfig) {
                throw new Error(`Cannot find config for ${settings_1.PLATFORM_NAME} in platforms array`);
            }
            // Cleaning space
            const i = ['hkHome', 'hkAway', 'hkNight', 'hkOff', 'pollingIntervalMinutes', 'CameraMaxLivestreamDuration'];
            Object.entries(pluginConfig).forEach(([key, value]) => {
                if (!i.includes(key)) {
                    return;
                }
                pluginConfig[key] = (typeof pluginConfig[key] === 'string') ? parseInt(value) : value;
            });
            // End of Cleaning space
            // Applying clean and save it
            this.config = pluginConfig;
            fs_1.default.writeFileSync(this.api.user.configPath(), JSON.stringify(currentConfig, null, 4));
        }
        catch (e) {
            this.log.error('Error cleaning config:', e);
        }
    }
    // this needs to be called after api did finished launching so that cached accessories are already loaded
    clean_config_after_init() {
        var _a, _b, _c;
        var _d, _e, _f;
        try {
            const currentConfig = JSON.parse(fs_1.default.readFileSync(this.api.user.configPath(), 'utf8'));
            // check the platforms section is an array before we do array things on it
            if (!Array.isArray(currentConfig.platforms)) {
                throw new Error('Cannot find platforms array in config');
            }
            // find this plugins current config
            const pluginConfig = currentConfig.platforms.find((x) => x.platform === settings_1.PLATFORM_NAME);
            if (!pluginConfig) {
                throw new Error(`Cannot find config for ${settings_1.PLATFORM_NAME} in platforms array`);
            }
            // Cleaning space
            // clean device specific parametes
            const cameras = (Array.isArray(pluginConfig.cameras)) ? pluginConfig.cameras : null;
            if (cameras && this.accessories.length > 0) {
                for (let i = 0; i < cameras.length; i++) {
                    const camera = cameras[i];
                    const cachedAccessory = this.accessories.find((acc) => camera.serialNumber === acc.context['device'].uniqueId);
                    if (cachedAccessory && eufy_security_client_1.Device.isDoorbell(cachedAccessory.context['device'].type) && !camera.enableCamera) {
                        // eslint-disable-next-line max-len
                        this.log.warn('Found camera ' + cachedAccessory.context['device'].displayName + ' (' + cachedAccessory.context['device'].uniqueId + ') with invalid camera configuration option enableCamera. Attempt to repair. This should only happen once per device...');
                        pluginConfig.cameras[i]['enableCamera'] = true;
                        if (camera.unbridge) {
                            // eslint-disable-next-line max-len
                            this.log.warn('Camera ' + cachedAccessory.context['device'].displayName + ' (' + cachedAccessory.context['device'].uniqueId + ') had camera configuration option \'unbridge\' set to true. This will be set to false to maintain functionality. See https://github.com/homebridge-eufy-security/plugin/issues/79 for more information.');
                            pluginConfig.cameras[i]['unbridge'] = false;
                        }
                    }
                }
            }
            // End of Cleaning space
            // Applying clean and save it
            this.config = pluginConfig;
            this.config.ignoreStations = (_a = (_d = this.config).ignoreStations) !== null && _a !== void 0 ? _a : (_d.ignoreStations = []);
            this.config.ignoreDevices = (_b = (_e = this.config).ignoreDevices) !== null && _b !== void 0 ? _b : (_e.ignoreDevices = []);
            this.config.cleanCache = (_c = (_f = this.config).cleanCache) !== null && _c !== void 0 ? _c : (_f.cleanCache = true);
            fs_1.default.writeFileSync(this.api.user.configPath(), JSON.stringify(currentConfig, null, 4));
        }
        catch (e) {
            this.log.error('Error cleaning config:', e);
        }
    }
}
exports.EufySecurityPlatform = EufySecurityPlatform;
//# sourceMappingURL=platform.js.map