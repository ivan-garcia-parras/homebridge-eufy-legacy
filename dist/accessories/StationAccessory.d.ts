import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { Station } from 'eufy-security-client';
import { StationConfig } from '../utils/configTypes';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class StationAccessory {
    private readonly platform;
    private readonly accessory;
    private eufyStation;
    private station;
    private service;
    private manualTriggerService;
    private alarm_triggered;
    private modes;
    private alarm_delayed;
    private alarm_delay_timeout?;
    protected characteristic: any;
    readonly stationConfig: StationConfig;
    private hkStateNames;
    private guardModeChangeTimeout;
    private retryGuardModeChangeTimeout;
    private dontSync;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyStation: Station);
    private getStationConfig;
    private onStationGuardModePushNotification;
    private onStationCurrentModePushNotification;
    private onStationAlarmEventPushNotification;
    private mappingHKEufy;
    convertHKtoEufy(hkMode: any): number;
    convertEufytoHK(eufyMode: any): number;
    /**
     * Handle requests to get the current value of the 'Security System Current State' characteristic
     */
    handleSecuritySystemCurrentStateGet(): Promise<CharacteristicValue>;
    /**
     * Handle requests to get the current value of the 'Security System Target State' characteristic
     */
    private handleSecuritySystemTargetStateGet;
    /**
     * Handle requests to set the 'Security System Target State' characteristic
     */
    private handleSecuritySystemTargetStateSet;
    private handleManualTriggerSwitchStateGet;
    private handleManualTriggerSwitchStateSet;
    private onStationAlarmDelayedEvent;
    private onStationAlarmArmedEvent;
    syncStationMode(mode: CharacteristicValue): void;
    getStationSerial(): string;
    private getGuardModeName;
    private handleRawPropertyChange;
    private handlePropertyChange;
    private handleCommandResult;
}
//# sourceMappingURL=StationAccessory.d.ts.map