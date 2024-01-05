import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { DeviceAccessory } from './Device';
import { EntrySensor } from 'eufy-security-client';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class EntrySensorAccessory extends DeviceAccessory {
    protected service: Service;
    protected EntrySensor: EntrySensor;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyDevice: EntrySensor);
    handleContactSensorStateGet(): Promise<CharacteristicValue>;
    private onDeviceOpenPushNotification;
}
//# sourceMappingURL=EntrySensorAccessory.d.ts.map