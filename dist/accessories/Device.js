"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceAccessory = void 0;
const eufy_security_client_1 = require("eufy-security-client");
class DeviceAccessory {
    constructor(platform, accessory, eufyDevice) {
        this.platform = platform;
        this.accessory = accessory;
        this.eufyDevice = eufyDevice;
        this.characteristic = this.platform.Characteristic;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.characteristic.Manufacturer, 'Eufy')
            .setCharacteristic(this.characteristic.Model, eufy_security_client_1.DeviceType[this.eufyDevice.getDeviceType()])
            .setCharacteristic(this.characteristic.SerialNumber, this.eufyDevice.getSerial())
            .setCharacteristic(this.characteristic.FirmwareRevision, this.eufyDevice.getSoftwareVersion())
            .setCharacteristic(this.characteristic.HardwareRevision, this.eufyDevice.getHardwareVersion());
        try {
            if (this.eufyDevice.hasProperty('battery') || this.eufyDevice.hasProperty('batteryLow')) {
                const batteryService = this.accessory.getService(this.platform.Service.Battery) ||
                    this.accessory.addService(this.platform.Service.Battery);
                batteryService.setCharacteristic(this.characteristic.Name, accessory.displayName);
                // create handlers for required characteristics of Battery service
                if (this.eufyDevice.hasProperty('battery')) {
                    this.platform.log.debug(this.accessory.displayName, 'has a battery, so append Battery characteristic to him.');
                    batteryService
                        .getCharacteristic(this.characteristic.BatteryLevel)
                        .onGet(this.handleBatteryLevelGet.bind(this));
                }
                else {
                    this.platform.log.debug(this.accessory.displayName, 'has a batteryLow, so append StatusLowBattery characteristic to him.');
                    batteryService
                        .getCharacteristic(this.characteristic.StatusLowBattery)
                        .onGet(this.handleStatusLowBatteryGet.bind(this));
                }
            }
            else {
                this.platform.log.debug(this.accessory.displayName, 'has no battery');
            }
        }
        catch (Error) {
            this.platform.log.error(this.accessory.displayName, 'raise error to check and attach a battery.', Error);
        }
        // check for operating mode and rtp stream management services (will only be on camera accessories)
        // remove this on startup so that possible changed settings (HKSV, codecs, ...) can take effect
        const operatingModeService = accessory.getService(this.platform.api.hap.Service.CameraOperatingMode);
        if (operatingModeService) {
            // if we don't remove the CameraOperatingMode Service from the accessory there might be
            // a crash on startup of the plugin
            accessory.removeService(operatingModeService);
        }
        const rtpStreamingManagementService = accessory.getService(this.platform.api.hap.Service.CameraRTPStreamManagement);
        if (rtpStreamingManagementService) {
            // reset rtp stream configuration on startup
            // this way codec changes are possible after
            // the camera has been added to HomeKit
            accessory.removeService(rtpStreamingManagementService);
        }
        if (this.platform.config.enableDetailedLogging) {
            this.eufyDevice.on('raw property changed', (device, type, value) => this.handleRawPropertyChange(device, type, value));
            this.eufyDevice.on('property changed', (device, name, value) => this.handlePropertyChange(device, name, value));
        }
    }
    handleRawPropertyChange(device, type, value) {
        this.platform.log.debug(this.accessory.displayName, 'Raw Property Changes:', type, value);
    }
    handlePropertyChange(device, name, value) {
        this.platform.log.debug(this.accessory.displayName, 'Property Changes:', name, value);
    }
    /**
     * Handle requests to get the current value of the "Status Low Battery" characteristic
     */
    async handleStatusLowBatteryGet() {
        try {
            const currentValue = await this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceBatteryLow);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceBatteryLow:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.error(this.accessory.displayName, 'handleStatusLowBatteryGet', 'Wrong return value');
            return false;
        }
    }
    /**
     * Handle requests to get the current value of the "Battery Level" characteristic
     */
    async handleBatteryLevelGet() {
        try {
            const currentValue = this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceBattery);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceBattery:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.error(this.accessory.displayName, 'handleBatteryLevelGet', 'Wrong return value');
            return 0;
        }
    }
}
exports.DeviceAccessory = DeviceAccessory;
//# sourceMappingURL=Device.js.map