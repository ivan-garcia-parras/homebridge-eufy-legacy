import { Service, PlatformAccessory } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { DeviceAccessory } from './Device';
import { Keypad } from 'eufy-security-client';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class KeypadAccessory extends DeviceAccessory {
    protected service: Service;
    protected Keypad: Keypad;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyDevice: Keypad);
    getCurrentDeviceState(): Promise<number>;
    /**
     * Handle requests to get the current value of the "Active" characteristic
     */
    handleOnGet(callback: any): Promise<void>;
    /**
     * Handle requests to set the "On" characteristic
     */
    handleOnSet(value: any, callback: any): Promise<void>;
}
//# sourceMappingURL=KeypadAccessory.d.ts.map