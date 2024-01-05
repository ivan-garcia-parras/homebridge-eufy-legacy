"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-var-requires */
const eufy_security_client_1 = require("eufy-security-client");
const plugin_ui_utils_1 = require("@homebridge/plugin-ui-utils");
const fs_1 = __importDefault(require("fs"));
const bunyan_1 = __importDefault(require("bunyan"));
const zip_lib_1 = require("zip-lib");
const types_1 = require("./configui/app/util/types");
const EufyClientInteractor_1 = require("./plugin/utils/EufyClientInteractor");
class UiServer extends plugin_ui_utils_1.HomebridgePluginUiServer {
    constructor() {
        super();
        this.accessories = [];
        this.storagePath = this.homebridgeStoragePath + '/eufysecurity';
        this.storedAccessories_file = this.storagePath + '/accessories.json';
        this.logZipFilePath = this.storagePath + '/logs.zip';
        this.eufyClient = null;
        const plugin = require('../package.json');
        this.log = bunyan_1.default.createLogger({
            name: '[EufySecurity-' + plugin.version + ']',
            hostname: '',
            streams: [{
                    level: 'debug',
                    type: 'rotating-file',
                    path: this.storagePath + '/configui-server.log',
                    period: '1d',
                    count: 3,
                }],
        });
        this.log.debug('Using bropats eufy-security-client library in version ' + eufy_security_client_1.libVersion);
        if (!fs_1.default.existsSync(this.storagePath)) {
            fs_1.default.mkdirSync(this.storagePath);
        }
        this.config = {
            username: '',
            password: '',
            language: 'en',
            persistentDir: this.storagePath,
            p2pConnectionSetup: 0,
            pollingIntervalMinutes: 10,
            eventDurationSeconds: 10,
            acceptInvitations: true,
        };
        this.onRequest('/login', this.login.bind(this));
        this.onRequest('/storedAccessories', this.loadStoredAccessories.bind(this));
        this.onRequest('/reset', this.resetPlugin.bind(this));
        this.onRequest('/downloadLogs', this.downloadLogs.bind(this));
        this.pluginConfigInteractor = new EufyClientInteractor_1.EufyClientInteractor(this.storagePath, this.log);
        this.onRequest('/getChargingStatus', (sn) => {
            return this.pluginConfigInteractor.DeviceIsCharging(sn);
        });
        this.onRequest('/setExperimentalRTSP', (options) => {
            return this.pluginConfigInteractor.DeviceSetExperimentalRTSP(options.sn, options.value);
        });
        this.onRequest('/getExperimentalRTSPStatus', (sn) => {
            return this.pluginConfigInteractor.DeviceGetExperimentalRTSPStatus(sn);
        });
        this.onRequest('/getStationDeviceMapping', () => {
            return this.pluginConfigInteractor.GetStationCamerasMapping();
        });
        this.ready();
    }
    async resetPersistentData() {
        try {
            fs_1.default.unlinkSync(this.storagePath + '/persistent.json');
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    async login(options) {
        var _a, _b;
        // delete persistent.json if new login
        try {
            if (options && options.username && options.password) {
                this.log.info('deleting persistent.json due to new login');
                await this.resetPersistentData();
            }
        }
        catch (err) {
            this.log.error('Could not delete persistent.json due to error: ' + err);
        }
        if (!this.eufyClient && options && options.username && options.password && options.country) {
            this.accessories = []; // clear accessories array so that it can be filled with all devices after login
            this.log.debug('init eufyClient');
            this.config.username = options.username;
            this.config.password = options.password;
            this.config.country = options.country;
            this.config.trustedDeviceName = options.deviceName;
            try {
                this.eufyClient = await eufy_security_client_1.EufySecurity.initialize(this.config, this.log);
            }
            catch (err) {
                this.log.error(err);
            }
            (_a = this.eufyClient) === null || _a === void 0 ? void 0 : _a.on('station added', this.addStation.bind(this));
            (_b = this.eufyClient) === null || _b === void 0 ? void 0 : _b.on('device added', this.addDevice.bind(this));
        }
        return new Promise((resolve, reject) => {
            var _a, _b, _c;
            const connectionTimeout = setTimeout(() => {
                resolve({
                    success: false,
                    failReason: types_1.LoginFailReason.TIMEOUT,
                });
            }, 25000);
            if (options && options.username && options.password && options.country) {
                // login with credentials
                this.log.debug('login with credentials');
                try {
                    this.loginHandlers(resolve);
                    (_a = this.eufyClient) === null || _a === void 0 ? void 0 : _a.connect().then(() => {
                        var _a;
                        this.log.debug('connected?: ' + ((_a = this.eufyClient) === null || _a === void 0 ? void 0 : _a.isConnected()));
                    }).catch((err) => this.log.error(err));
                }
                catch (err) {
                    this.log.error(err);
                    resolve({
                        success: false,
                        failReason: types_1.LoginFailReason.UNKNOWN,
                        data: {
                            error: err,
                        },
                    });
                }
            }
            else if (options && options.verifyCode) {
                // login with tfa code
                try {
                    this.loginHandlers(resolve);
                    (_b = this.eufyClient) === null || _b === void 0 ? void 0 : _b.connect({
                        verifyCode: options.verifyCode,
                        force: false,
                    });
                }
                catch (err) {
                    resolve({
                        success: false,
                        failReason: types_1.LoginFailReason.UNKNOWN,
                        data: {
                            error: err,
                        },
                    });
                }
            }
            else if (options && options.captcha) {
                // login witch captcha
                try {
                    this.loginHandlers(resolve);
                    (_c = this.eufyClient) === null || _c === void 0 ? void 0 : _c.connect({
                        captcha: {
                            captchaCode: options.captcha.captchaCode,
                            captchaId: options.captcha.captchaId,
                        },
                        force: false,
                    });
                }
                catch (err) {
                    resolve({
                        success: false,
                        failReason: types_1.LoginFailReason.UNKNOWN,
                        data: {
                            error: err,
                        },
                    });
                }
            }
            else {
                reject('unsupported login method');
            }
        });
    }
    async loadStoredAccessories() {
        try {
            const accessories = JSON.parse(fs_1.default.readFileSync(this.storedAccessories_file, { encoding: 'utf-8' }));
            return Promise.resolve(accessories);
        }
        catch (err) {
            this.log.error('Could not get stored accessories. Most likely no stored accessories yet: ' + err);
            return Promise.reject([]);
        }
    }
    loginHandlers(resolveCallback) {
        var _a, _b, _c;
        (_a = this.eufyClient) === null || _a === void 0 ? void 0 : _a.once('tfa request', () => {
            this.log.debug('tfa request event');
            resolveCallback({
                success: false,
                failReason: types_1.LoginFailReason.TFA, // TFA
            });
        });
        (_b = this.eufyClient) === null || _b === void 0 ? void 0 : _b.once('captcha request', (id, captcha) => {
            this.log.debug('captcha request event');
            resolveCallback({
                success: false,
                failReason: types_1.LoginFailReason.CAPTCHA,
                data: {
                    id: id,
                    captcha: captcha,
                },
            });
        });
        (_c = this.eufyClient) === null || _c === void 0 ? void 0 : _c.once('connect', () => {
            this.log.debug('connect event');
            if (this.eufyClient) {
                this.pluginConfigInteractor.setClient(this.eufyClient);
            }
            resolveCallback({
                success: true,
            });
        });
    }
    addStation(station) {
        const s = {
            uniqueId: station.getSerial(),
            displayName: station.getName(),
            station: true,
            type: station.getDeviceType(),
        };
        this.accessories.push(s);
        this.storeAccessories();
        this.pushEvent('addAccessory', s);
    }
    addDevice(device) {
        const d = {
            uniqueId: device.getSerial(),
            displayName: device.getName(),
            station: false,
            type: device.getDeviceType(),
        };
        this.accessories.push(d);
        this.storeAccessories();
        this.pushEvent('addAccessory', d);
    }
    storeAccessories() {
        fs_1.default.writeFileSync(this.storedAccessories_file, JSON.stringify(this.accessories));
    }
    async resetPlugin() {
        try {
            fs_1.default.rmSync(this.storagePath, { recursive: true });
            return { result: 1 }; //file removed
        }
        catch (err) {
            return { result: 0 }; //error while removing the file
        }
    }
    async downloadLogs() {
        this.log.info(`compressing log files to ${this.logZipFilePath} and sending to client.`);
        if (!this.removeCompressedLogs()) {
            this.log.error('There were already old compressed log files that could not be removed!');
            return Promise.reject('There were already old compressed log files that could not be removed!');
        }
        return new Promise((resolve, reject) => {
            const zip = new zip_lib_1.Zip();
            let numberOfFiles = 0;
            if (fs_1.default.existsSync(this.storagePath + '/log-lib.log')) {
                zip.addFile(this.storagePath + '/log-lib.log');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/log-lib.log.0')) {
                zip.addFile(this.storagePath + '/log-lib.log.0');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/log-lib.log.1')) {
                zip.addFile(this.storagePath + '/log-lib.log.1');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/log-lib.log.2')) {
                zip.addFile(this.storagePath + '/log-lib.log.2');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/eufy-log.log')) {
                zip.addFile(this.storagePath + '/eufy-log.log');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/eufy-log.log.0')) {
                zip.addFile(this.storagePath + '/eufy-log.log.0');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/eufy-log.log.1')) {
                zip.addFile(this.storagePath + '/eufy-log.log.1');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/eufy-log.log.2')) {
                zip.addFile(this.storagePath + '/eufy-log.log.2');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/configui-server.log')) {
                zip.addFile(this.storagePath + '/configui-server.log');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/configui-server.log.0')) {
                zip.addFile(this.storagePath + '/configui-server.log.0');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/configui-server.log.1')) {
                zip.addFile(this.storagePath + '/configui-server.log.1');
                numberOfFiles++;
            }
            if (fs_1.default.existsSync(this.storagePath + '/configui-server.log.2')) {
                zip.addFile(this.storagePath + '/configui-server.log.2');
                numberOfFiles++;
            }
            if (numberOfFiles === 0) {
                throw new Error('No log files were found');
            }
            this.pushEvent('downloadLogsFileCount', { numberOfFiles: numberOfFiles });
            zip.archive(this.logZipFilePath).then(() => {
                const fileBuffer = fs_1.default.readFileSync(this.logZipFilePath);
                resolve(fileBuffer);
            }).catch((err) => {
                this.log.error('Error while generating log files: ' + err);
                reject(err);
            }).finally(() => this.removeCompressedLogs());
        });
    }
    removeCompressedLogs() {
        try {
            if (fs_1.default.existsSync(this.logZipFilePath)) {
                fs_1.default.unlinkSync(this.logZipFilePath);
            }
            return true;
        }
        catch (_a) {
            return false;
        }
    }
}
// start the instance of the server
(() => {
    return new UiServer();
})();
//# sourceMappingURL=server.js.map