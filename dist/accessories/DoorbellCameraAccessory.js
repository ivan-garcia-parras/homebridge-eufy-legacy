"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoorbellCameraAccessory = void 0;
// import { HttpService, LocalLookupService, DeviceClientService, CommandType } from 'eufy-node-client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore  
const eufy_security_client_1 = require("eufy-security-client");
const CameraAccessory_1 = require("./CameraAccessory");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class DoorbellCameraAccessory extends CameraAccessory_1.CameraAccessory {
    constructor(platform, accessory, eufyDevice) {
        var _a, _b;
        super(platform, accessory, eufyDevice, true);
        this.DoorbellCamera = eufyDevice;
        this.platform.log.debug(this.accessory.displayName, 'Constructed Doorbell');
        this.doorbellService =
            this.accessory.getService(this.platform.Service.Doorbell) ||
                this.accessory.addService(this.platform.Service.Doorbell);
        this.ring_triggered = false;
        // set the Battery service characteristics
        this.doorbellService.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);
        // create handlers for required characteristics of Battery service
        this.doorbellService
            .getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
            .onGet(() => null);
        this.DoorbellCamera.on('rings', (device, state) => this.onDeviceRingsPushNotification());
        if (this.cameraControllerOptions) {
            const doorbellOptions = {
                externalDoorbellService: this.doorbellService,
            };
            const controller = new this.platform.api.hap.DoorbellController({ ...this.cameraControllerOptions, ...doorbellOptions });
            (_a = this.streamingDelegate) === null || _a === void 0 ? void 0 : _a.setController(controller);
            (_b = this.recordingDelegate) === null || _b === void 0 ? void 0 : _b.setController(controller);
            accessory.configureController(controller);
            this.cameraSetup(accessory);
        }
        this.doorbellService.setPrimaryService(true);
        // add indoor chime switch
        try {
            if ((this.eufyDevice.isBatteryDoorbell() || this.eufyDevice.isWiredDoorbell()) && this.cameraConfig.indoorChimeButton) {
                this.platform.log.debug(this.accessory.displayName, 'indoorChimeSwitch config:', this.cameraConfig.indoorChimeButton);
                this.platform.log.debug(this.accessory.displayName, 'has a indoorChime, so append indoorChimeSwitchService to it.');
                this.indoorChimeSwitchService =
                    this.accessory.getService('indoorChimeSwitch') ||
                        this.accessory.addService(this.platform.Service.Switch, 'indoorChimeSwitch', 'indoorChime');
                this.indoorChimeSwitchService.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName + ' indoor chime');
                // this.indoorChimeSwitchService.setCharacteristic(this.platform.Characteristic.ConfiguredName,
                //   this.accessory.displayName + ' indoor chime');
                this.indoorChimeSwitchService.getCharacteristic(this.characteristic.On)
                    .onGet(this.handleIndoorChimeGet.bind(this))
                    .onSet(this.handleIndoorChimeSet.bind(this));
            }
            else {
                this.platform.log.debug(this.accessory.displayName, 'Looks like not compatible with indoorChime or this has been disabled within configuration');
                // remove indoorChimeButton service if the user has disabled the it through the config
                this.indoorChimeSwitchService = accessory.getService('indoorChimeSwitch');
                if (this.indoorChimeSwitchService) {
                    this.platform.log.debug(this.accessory.displayName, 'removing indoorChimeSwitch service.');
                    accessory.removeService(this.indoorChimeSwitchService);
                }
            }
        }
        catch (err) {
            this.platform.log.error(this.accessory.displayName, 'raise error in indoorChimeSwitchService.', err);
        }
    }
    // We receive 2 push when Doorbell ring, mute the second by checking if we already send
    // the event to HK then reset the marker when 2nd times occurs
    onDeviceRingsPushNotification() {
        if (!this.ring_triggered) {
            this.ring_triggered = true;
            this.platform.log.debug(this.accessory.displayName, 'DoorBell ringing');
            this.doorbellService
                .getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
                .updateValue(this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
        }
        else {
            this.ring_triggered = false;
        }
    }
    async handleIndoorChimeGet() {
        try {
            const currentValue = this.eufyDevice.getPropertyValue(eufy_security_client_1.PropertyName.DeviceChimeIndoor);
            this.platform.log.debug(this.accessory.displayName, 'GET DeviceChimeIndoor:', currentValue);
            return currentValue;
        }
        catch (_a) {
            this.platform.log.debug(this.accessory.displayName, 'handleIndoorChimeGet', 'Wrong return value');
            return false;
        }
    }
    async handleIndoorChimeSet(value) {
        try {
            this.platform.log.debug(this.accessory.displayName, 'SET DeviceChimeIndoor:', value);
            const station = await this.platform.getStationById(this.eufyDevice.getStationSerial());
            await station.enableIndoorChime(this.eufyDevice, value);
        }
        catch (err) {
            this.platform.log.debug(this.accessory.displayName, 'handleIndoorChimeSet error', err);
        }
    }
}
exports.DoorbellCameraAccessory = DoorbellCameraAccessory;
//# sourceMappingURL=DoorbellCameraAccessory.js.map