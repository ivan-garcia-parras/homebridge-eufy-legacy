"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntrySensorAccessory = void 0;
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
class EntrySensorAccessory extends Device_1.DeviceAccessory {
    constructor(platform, accessory, eufyDevice) {
        super(platform, accessory, eufyDevice);
        this.platform.log.debug(this.accessory.displayName, 'Constructed Entry Sensor');
        this.EntrySensor = eufyDevice;
        this.service =
            this.accessory.getService(this.platform.Service.ContactSensor) ||
                this.accessory.addService(this.platform.Service.ContactSensor);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);
        try {
            if (this.eufyDevice.hasProperty('sensorOpen')) {
                this.platform.log.debug(this.accessory.displayName, 'has a sensorOpen, so append ContactSensorState characteristic to him.');
                // create handlers for required characteristics
                this.service
                    .getCharacteristic(this.platform.Characteristic.ContactSensorState)
                    .onGet(this.handleContactSensorStateGet.bind(this));
                this.EntrySensor.on('open', (device, open) => this.onDeviceOpenPushNotification(device, open));
            }
            else {
                this.platform.log.warn(this.accessory.displayName, 'has no sensorOpen');
            }
        }
        catch (Error) {
            this.platform.log.error(this.accessory.displayName, 'raise error to check and attach a sensorOpen.', Error);
        }
    }
    async handleContactSensorStateGet() {
        try {
            const currentValue = this.EntrySensor.getPropertyValue(eufy_security_client_1.PropertyName.DeviceSensorOpen);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceSensorOpen:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.error(this.accessory.displayName, 'handleContactSensorStateGet', 'Wrong return value');
            return false;
        }
    }
    onDeviceOpenPushNotification(device, open) {
        this.platform.log.debug(this.accessory.displayName, 'Handle Motion Sensor:', open);
        this.service
            .getCharacteristic(this.platform.Characteristic.ContactSensorState)
            .updateValue(open);
    }
}
exports.EntrySensorAccessory = EntrySensorAccessory;
//# sourceMappingURL=EntrySensorAccessory.js.map