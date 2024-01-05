"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotionSensorAccessory = void 0;
const Device_1 = require("./Device");
// import { HttpService, LocalLookupService, DeviceClientService, CommandType } from 'eufy-node-client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore  
const eufy_security_client_1 = require("eufy-security-client");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class MotionSensorAccessory extends Device_1.DeviceAccessory {
    constructor(platform, accessory, eufyDevice) {
        super(platform, accessory, eufyDevice);
        this.platform.log.debug(this.accessory.displayName, 'Constructed Motion Sensor');
        this.MotionSensor = eufyDevice;
        this.service =
            this.accessory.getService(this.platform.Service.MotionSensor) ||
                this.accessory.addService(this.platform.Service.MotionSensor);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);
        try {
            if (this.eufyDevice.hasProperty('motionDetected')) {
                this.platform.log.debug(this.accessory.displayName, 'has a motionDetected, so append MotionDetected characteristic to him.');
                // create handlers for required characteristics
                this.service
                    .getCharacteristic(this.platform.Characteristic.MotionDetected)
                    .onGet(this.handleMotionDetectedGet.bind(this));
                this.MotionSensor.on('motion detected', (device, motion) => this.onDeviceMotionDetectedPushNotification(device, motion));
            }
            else {
                this.platform.log.warn(this.accessory.displayName, 'has no motionDetected');
            }
        }
        catch (Error) {
            this.platform.log.error(this.accessory.displayName, 'raise error to check and attach a motionDetected.', Error);
        }
    }
    async handleMotionDetectedGet() {
        try {
            const currentValue = this.MotionSensor.getPropertyValue(eufy_security_client_1.PropertyName.DeviceMotionDetected);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceMotionDetected:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.error(this.accessory.displayName, 'handleMotionDetectedGet', 'Wrong return value');
            return false;
        }
    }
    onDeviceMotionDetectedPushNotification(device, motion) {
        this.platform.log.debug(this.accessory.displayName, 'Handle Camera motion:', motion);
        this.service
            .getCharacteristic(this.characteristic.MotionDetected)
            .updateValue(motion);
    }
}
exports.MotionSensorAccessory = MotionSensorAccessory;
//# sourceMappingURL=MotionSensorAccessory.js.map