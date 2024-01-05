import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { Device } from 'eufy-security-client';
export declare abstract class DeviceAccessory {
    protected eufyDevice: Device;
    protected platform: EufySecurityPlatform;
    protected accessory: PlatformAccessory;
    protected characteristic: any;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyDevice: Device);
    private handleRawPropertyChange;
    private handlePropertyChange;
    /**
     * Handle requests to get the current value of the "Status Low Battery" characteristic
     */
    handleStatusLowBatteryGet(): Promise<CharacteristicValue>;
    /**
     * Handle requests to get the current value of the "Battery Level" characteristic
     */
    handleBatteryLevelGet(): Promise<CharacteristicValue>;
}
//# sourceMappingURL=Device.d.ts.map