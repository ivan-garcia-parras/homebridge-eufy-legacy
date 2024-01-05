"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartLockAccessory = void 0;
const Device_1 = require("./Device");
const eufy_security_client_1 = require("eufy-security-client");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class SmartLockAccessory extends Device_1.DeviceAccessory {
    constructor(platform, accessory, eufyDevice) {
        super(platform, accessory, eufyDevice);
        this.platform.log.debug(this.accessory.displayName, 'Constructed SmartLock');
        this.SmartLock = eufyDevice;
        this.service =
            this.accessory.getService(this.platform.Service.LockMechanism) ||
                this.accessory.addService(this.platform.Service.LockMechanism);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);
        // create handlers for required characteristics
        this.service
            .getCharacteristic(this.platform.Characteristic.LockCurrentState)
            .onGet(this.handleLockCurrentStateGet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.LockTargetState)
            .onGet(this.handleLockTargetStateGet.bind(this))
            .onSet(this.handleLockTargetStateSet.bind(this));
        this.SmartLock.on('property changed', this.onSmartLockPropertyChange.bind(this));
        // update the lock state at startup
        const lockStatus = this.SmartLock.isLocked();
        this.platform.log.debug(this.accessory.displayName, 'initial lock eufy state ' + lockStatus);
        this.service
            .getCharacteristic(this.platform.Characteristic.LockCurrentState)
            .updateValue(this.convertlockStatusCode(lockStatus));
    }
    /**
     * Handle requests to get the current value of the 'Security System Current State' characteristic
     */
    async handleLockCurrentStateGet() {
        const lockStatus = this.getLockStatus();
        this.platform.log.debug(this.accessory.displayName, 'Triggered GET LockCurrentState', lockStatus);
        return lockStatus;
    }
    async handleLockTargetStateGet() {
        const lockStatus = this.getLockStatus(false);
        this.platform.log.debug(this.accessory.displayName, 'Triggered GET LockTargetState', lockStatus);
        return lockStatus;
    }
    async handleLockTargetStateSet(value) {
        this.platform.log.debug(this.accessory.displayName, 'Triggered SET LockTargetState', value);
        try {
            const stationSerial = this.SmartLock.getStationSerial();
            const station = await this.platform.getStationById(stationSerial);
            await station.lockDevice(this.SmartLock, !!value);
        }
        catch (err) {
            this.platform.log.error(this.accessory.displayName, 'Lock target state could not be set: ' + err);
        }
    }
    getLockStatus(current = true) {
        const lockStatus = this.SmartLock.isLocked();
        return this.convertlockStatusCode(lockStatus, current);
    }
    convertlockStatusCode(lockStatus, current = true) {
        // 1: "1",
        // 2: "2",
        // 3: "UNLOCKED",
        // 4: "LOCKED",
        // 5: "MECHANICAL_ANOMALY",
        // 6: "6",
        // 7: "7",
        this.platform.log.debug(this.accessory.displayName, 'LockStatus', lockStatus);
        switch (lockStatus) {
            case true:
            case 4:
                return (current) ? this.platform.Characteristic.LockCurrentState.SECURED : this.platform.Characteristic.LockTargetState.SECURED;
            case false:
            case 3:
                return (current) ? this.platform.Characteristic.LockCurrentState.UNSECURED : this.platform.Characteristic.LockTargetState.UNSECURED;
            case 5:
                // return SECURED as TargetState if jammed
                return (current) ? this.platform.Characteristic.LockCurrentState.JAMMED : this.platform.Characteristic.LockTargetState.SECURED;
            default:
                this.platform.log.warn(this.accessory.displayName, 'Something wrong on the lockstatus feedback');
                // return SECURED as TargetState if unknown
                return (current) ? this.platform.Characteristic.LockCurrentState.UNKNOWN : this.platform.Characteristic.LockTargetState.SECURED;
        }
    }
    onSmartLockPropertyChange(_, name, value) {
        if (name === eufy_security_client_1.PropertyName.DeviceLockStatus) {
            this.platform.log.debug(this.accessory.displayName, 'Handle Lock Status:  -- ', value);
            this.service
                .getCharacteristic(this.platform.Characteristic.LockCurrentState)
                .updateValue(this.convertlockStatusCode(value));
        }
    }
}
exports.SmartLockAccessory = SmartLockAccessory;
//# sourceMappingURL=SmartLockAccessory.js.map