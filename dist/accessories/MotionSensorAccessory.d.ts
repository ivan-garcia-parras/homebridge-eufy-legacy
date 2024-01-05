import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { DeviceAccessory } from './Device';
import { MotionSensor } from 'eufy-security-client';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class MotionSensorAccessory extends DeviceAccessory {
    protected service: Service;
    protected MotionSensor: MotionSensor;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyDevice: MotionSensor);
    handleMotionDetectedGet(): Promise<CharacteristicValue>;
    private onDeviceMotionDetectedPushNotification;
}
//# sourceMappingURL=MotionSensorAccessory.d.ts.map