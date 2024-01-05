"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EufyClientInteractor = void 0;
const events_1 = __importDefault(require("events"));
const fs_1 = __importDefault(require("fs"));
const net_1 = __importDefault(require("net"));
const eufy_security_client_1 = require("eufy-security-client");
const pick_port_1 = __importDefault(require("pick-port"));
const interfaces_1 = require("./interfaces");
const experimental_1 = require("./experimental");
var InteractorRequestType;
(function (InteractorRequestType) {
    InteractorRequestType["DeviceChargingStatus"] = "deviceChargingStatus";
    InteractorRequestType["DeviceChangeExperimentalRTSPStatus"] = "deviceExperimentalRtspStatusChange";
    InteractorRequestType["DeviceGetExperimentalRTSPStatus"] = "deviceExperimentalRtspStatusGet";
    InteractorRequestType["GetStationDevicesMapping"] = "stationDevicesMapping";
})(InteractorRequestType || (InteractorRequestType = {}));
class EufyClientInteractor extends events_1.default {
    constructor(path, log, client) {
        super();
        this.log = log;
        this.storagePath = path;
        this.client = client;
    }
    setClient(client) {
        this.client = client;
    }
    async setupServer() {
        const port = await this.getFreePort();
        if (!this.writePortToStoragePath(port)) {
            return Promise.reject(new Error('Could not start interaction server'));
        }
        return new Promise((resolve, reject) => {
            this.server = net_1.default.createServer((socket) => {
                socket.on('data', (data) => {
                    const request = JSON.parse(data.toString('utf-8'));
                    this.log.debug(`incoming Interaction Request: for ${request.serialNumber}, type: ${request.type}`);
                    this.processIPCRequest(socket, request);
                });
                socket.on('error', this.onSocketError.bind(this));
            });
            this.server.on('error', this.onServerError.bind(this));
            this.server.listen(port, () => {
                this.log.debug(`Plugin-Config interaction server was started on port: ${port}`);
                resolve();
            });
        });
    }
    stopServer() {
        if (this.server) {
            this.server.close();
        }
    }
    async getFreePort() {
        return await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
    }
    writePortToStoragePath(port) {
        try {
            fs_1.default.writeFileSync(this.storagePath + '/interaction.port', `${port}`, { encoding: 'utf-8' });
            return true;
        }
        catch (err) {
            return false;
        }
    }
    loadPort() {
        try {
            const port = fs_1.default.readFileSync(this.storagePath + '/interaction.port', { encoding: 'utf-8' });
            return parseInt(port);
        }
        catch (err) {
            return -1;
        }
    }
    ipcRequest(request) {
        this.log.debug(`Interaction Request: for ${request.serialNumber}, type: ${request.type}`);
        return new Promise((resolve, reject) => {
            const port = this.loadPort();
            if (port <= 0) {
                reject('Could not read port for interaction server');
            }
            const socket = net_1.default.createConnection(port, 'localhost', () => {
                socket.write(JSON.stringify(request));
            });
            const timeout = setTimeout(() => {
                socket.destroy();
                reject('no answer was retrieved from server');
            }, 10000);
            socket.on('error', (err) => {
                reject(err);
                socket.destroy();
            });
            socket.on('data', (data) => {
                const response = JSON.parse(data.toString('utf-8'));
                if (response.serialNumber !== request.serialNumber || response.type !== request.type) {
                    reject(new Error('invalid ipc response'));
                }
                else {
                    resolve(response);
                }
                clearTimeout(timeout);
                socket.destroy();
            });
        });
    }
    async processIPCRequest(socket, request) {
        if (!this.client) {
            const response = {
                serialNumber: request.serialNumber,
                type: request.type,
                error: new interfaces_1.EufyClientNotRunningError('eufy client not running'),
            };
            socket.write(JSON.stringify(response));
            return;
        }
        let response = {
            serialNumber: request.serialNumber,
            type: request.type,
        };
        try {
            response = await this.processDirectRequest(request);
        }
        catch (err) {
            response.error = err;
        }
        // eslint-disable-next-line max-len
        this.log.debug(`outgoing Interaction Response: for ${response.serialNumber}, type: ${response.type}, result: ${response.result}, error: ${response.error}`);
        socket.write(JSON.stringify(response));
    }
    async processDirectRequest(request) {
        if (!this.client) {
            // forward to interaction server
            return this.ipcRequest(request);
        }
        const response = {
            serialNumber: request.serialNumber,
            type: request.type,
        };
        try {
            switch (request.type) {
                case InteractorRequestType.DeviceChargingStatus:
                    response.result = await this.getChargingStatus(request);
                    break;
                case InteractorRequestType.DeviceChangeExperimentalRTSPStatus:
                    response.result = await this.getExperimentalRTSPStatusChangeResult(request);
                    break;
                case InteractorRequestType.DeviceGetExperimentalRTSPStatus:
                    response.result = await this.getExperimentalRTSPState(request);
                    break;
                case InteractorRequestType.GetStationDevicesMapping:
                    response.result = await this.getStationCamerasMap(request);
                    break;
                default:
                    response.error = new Error('Request type not implemented.');
                    break;
            }
        }
        catch (err) {
            response.error = err;
        }
        // eslint-disable-next-line max-len
        this.log.debug(`Interaction Response: for ${response.serialNumber}, type: ${response.type}, result: ${response.result}, error: ${response.error}`);
        return Promise.resolve(response);
    }
    async getChargingStatus(request) {
        const device = await this.client.getDevice(request.serialNumber);
        return new Promise((resolve, reject) => {
            if (!device.hasBattery()) {
                // device has no battery, so it is always powered with plug
                resolve(3);
            }
            else if (device.hasProperty(eufy_security_client_1.PropertyName.DeviceChargingStatus)) {
                resolve(device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceChargingStatus));
            }
            else {
                reject(new Error('battery charging property could not be retrieved'));
            }
        });
    }
    async getExperimentalRTSPStatusChangeResult(request) {
        (0, experimental_1.initializeExperimentalMode)();
        const device = await this.client.getDevice(request.serialNumber);
        const station = await this.client.getStation(device.getStationSerial());
        return new Promise((resolve, reject) => {
            if (request.value === undefined) {
                reject(new Error('no value was given'));
            }
            else if (!device.hasProperty(eufy_security_client_1.PropertyName.DeviceRTSPStream) &&
                !device.hasProperty(eufy_security_client_1.PropertyName['ExperimentalModification'])) {
                reject(new Error('device has no experimental rtsp setting'));
            }
            else {
                let to = undefined;
                const propertyListener = (d, name, value) => {
                    if (request.value) {
                        if (device.getSerial() === d.getSerial() && name === eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl && value) {
                            if (to) {
                                clearTimeout(to);
                            }
                            device.removeListener('property changed', propertyListener);
                            resolve(value);
                        }
                    }
                    else {
                        if (device.getSerial() === d.getSerial() && name === eufy_security_client_1.PropertyName.DeviceRTSPStream && value === false) {
                            if (to) {
                                clearTimeout(to);
                            }
                            device.removeListener('property changed', propertyListener);
                            resolve('');
                        }
                    }
                };
                to = setTimeout(() => {
                    device.removeListener('property changed', propertyListener);
                    reject(new Error('setting rtsp feature timed out'));
                }, 15000);
                device.on('property changed', propertyListener);
                station.setRTSPStream(device, request.value);
            }
        });
    }
    async getExperimentalRTSPState(request) {
        (0, experimental_1.initializeExperimentalMode)();
        try {
            const device = await this.client.getDevice(request.serialNumber);
            let state = device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStream);
            const url = device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl);
            if (url && url !== '') {
                state = true;
            }
            return Promise.resolve({
                state: state,
                url: url,
            });
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    async getStationCamerasMap(request) {
        try {
            const stations = this.client.getStations();
            const devices = await this.client.getDevices();
            const result = {};
            for (const device of devices) {
                if (!device.isCamera()) {
                    continue;
                }
                const stationSN = device.getStationSerial();
                const devicesArray = result[stationSN];
                if (Array.isArray(devicesArray)) {
                    devicesArray.push(device.getSerial());
                }
                else {
                    result[stationSN] = [device.getSerial()];
                }
            }
            return Promise.resolve(result);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    onSocketError(err) {
        this.log.error(`There was an error on the PluginConfigInteractor socket: ${err}`);
    }
    onServerError(err) {
        this.log.error(`There was an error on the PluginConfigInteractor server: ${err}`);
    }
    async DeviceIsCharging(sn) {
        const request = {
            serialNumber: sn,
            type: InteractorRequestType.DeviceChargingStatus,
        };
        try {
            const response = await this.processDirectRequest(request);
            if (response.error) {
                return Promise.reject(response.error.message);
            }
            if (response.result === undefined) {
                return Promise.reject('there was no result');
            }
            return Promise.resolve(response.result);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    async DeviceSetExperimentalRTSP(sn, value) {
        const request = {
            serialNumber: sn,
            type: InteractorRequestType.DeviceChangeExperimentalRTSPStatus,
            value: value,
        };
        try {
            const response = await this.processDirectRequest(request);
            if (response.error) {
                return Promise.reject(response.error.message);
            }
            if (response.result === undefined) {
                return Promise.reject('there was no result');
            }
            return Promise.resolve(response.result);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    async DeviceGetExperimentalRTSPStatus(sn) {
        const request = {
            serialNumber: sn,
            type: InteractorRequestType.DeviceGetExperimentalRTSPStatus,
        };
        try {
            const response = await this.processDirectRequest(request);
            if (response.error) {
                return Promise.reject(response.error.message);
            }
            if (response.result === undefined) {
                return Promise.reject('there was no result');
            }
            return Promise.resolve(response.result);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    async GetStationCamerasMapping() {
        const request = {
            serialNumber: '',
            type: InteractorRequestType.GetStationDevicesMapping,
        };
        try {
            const response = await this.processDirectRequest(request);
            if (response.error) {
                return Promise.reject(response.error.message);
            }
            if (response.result === undefined) {
                return Promise.reject('there was no result');
            }
            return Promise.resolve(response.result);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
}
exports.EufyClientInteractor = EufyClientInteractor;
//# sourceMappingURL=EufyClientInteractor.js.map