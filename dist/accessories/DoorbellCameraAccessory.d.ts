import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { DoorbellCamera } from 'eufy-security-client';
import { CameraAccessory } from './CameraAccessory';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class DoorbellCameraAccessory extends CameraAccessory {
    protected DoorbellCamera: DoorbellCamera;
    private ring_triggered;
    private doorbellService;
    private indoorChimeSwitchService?;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyDevice: DoorbellCamera);
    private onDeviceRingsPushNotification;
    handleIndoorChimeGet(): Promise<CharacteristicValue>;
    handleIndoorChimeSet(value: CharacteristicValue): Promise<void>;
}
//# sourceMappingURL=DoorbellCameraAccessory.d.ts.map