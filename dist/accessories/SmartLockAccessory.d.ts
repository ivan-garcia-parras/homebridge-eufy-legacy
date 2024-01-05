import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { DeviceAccessory } from './Device';
import { Lock } from 'eufy-security-client';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class SmartLockAccessory extends DeviceAccessory {
    protected service: Service;
    protected SmartLock: Lock;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyDevice: Lock);
    /**
     * Handle requests to get the current value of the 'Security System Current State' characteristic
     */
    handleLockCurrentStateGet(): Promise<CharacteristicValue>;
    handleLockTargetStateGet(): Promise<CharacteristicValue>;
    handleLockTargetStateSet(value: any): Promise<void>;
    getLockStatus(current?: boolean): 1 | 0 | 2 | 3;
    convertlockStatusCode(lockStatus: any, current?: boolean): 1 | 0 | 2 | 3;
    private onSmartLockPropertyChange;
}
//# sourceMappingURL=SmartLockAccessory.d.ts.map