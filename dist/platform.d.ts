import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { EufySecurityPlatformConfig } from './config';
import { StationAccessory } from './accessories/StationAccessory';
import { EufySecurity, Station } from 'eufy-security-client';
export declare class EufySecurityPlatform implements DynamicPlatformPlugin {
    readonly hblog: Logger;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    eufyClient: EufySecurity;
    readonly accessories: PlatformAccessory[];
    config: EufySecurityPlatformConfig;
    private eufyConfig;
    log: any;
    private tsLogger;
    readonly eufyPath: string;
    private activeAccessoryIds;
    private cleanCachedAccessoriesTimeout?;
    private pluginConfigInteractor?;
    private stations;
    constructor(hblog: Logger, config: PlatformConfig, api: API);
    private pluginSetup;
    private tfaWarning;
    private captchaWarning;
    private stationAdded;
    private deviceAdded;
    private processAccessory;
    private pluginShutdown;
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory): void;
    private cleanCachedAccessories;
    private register_accessory;
    getStationById(id: string): Promise<Station>;
    getStationAccessories(): StationAccessory[];
    private clean_config;
    private clean_config_after_init;
}
//# sourceMappingURL=platform.d.ts.map