"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeypadAccessory = void 0;
const Device_1 = require("./Device");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class KeypadAccessory extends Device_1.DeviceAccessory {
    constructor(platform, accessory, eufyDevice) {
        super(platform, accessory, eufyDevice);
        this.Keypad = eufyDevice;
        this.platform.log.debug(this.accessory.displayName, 'Constructed Keypad');
        // set accessory information
        this.service =
            this.accessory.getService(this.platform.Service.Switch) ||
                this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);
        // create handlers for required characteristics
        this.service
            .getCharacteristic(this.platform.Characteristic.On)
            .on('get', this.handleOnGet.bind(this))
            .on('set', this.handleOnSet.bind(this));
    }
    async getCurrentDeviceState() {
        const state = this.Keypad.getState();
        return state;
    }
    /**
     * Handle requests to get the current value of the "Active" characteristic
     */
    async handleOnGet(callback) {
        this.platform.log.debug(this.accessory.displayName, 'Triggered GET Active');
        const currentDeviceState = await this.getCurrentDeviceState();
        // set this to a valid value for Active
        const currentValue = currentDeviceState === 1 ? 1 : 0;
        callback(null, currentValue);
    }
    /**
     * Handle requests to set the "On" characteristic
     */
    async handleOnSet(value, callback) {
        const currentDeviceState = await this.getCurrentDeviceState();
        // set this to a valid value for Active
        const currentValue = currentDeviceState === 1 ? 1 : 0;
        this.service.updateCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState, currentValue);
        callback(null);
    }
}
exports.KeypadAccessory = KeypadAccessory;
//# sourceMappingURL=KeypadAccessory.js.map