"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StationAccessory = void 0;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore  
const eufy_security_client_1 = require("eufy-security-client");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class StationAccessory {
    constructor(platform, accessory, eufyStation) {
        this.platform = platform;
        this.accessory = accessory;
        this.eufyStation = eufyStation;
        this.hkStateNames = {
            0: 'Home',
            1: 'Away',
            2: 'Night',
            3: 'Off',
        };
        this.guardModeChangeTimeout = null;
        this.retryGuardModeChangeTimeout = null;
        this.dontSync = false;
        this.platform.log.debug(this.accessory.displayName, 'Constructed Station');
        // set accessory information
        this.station = eufyStation;
        this.characteristic = this.platform.Characteristic;
        this.stationConfig = this.getStationConfig();
        this.mappingHKEufy();
        this.alarm_triggered = false;
        this.alarm_delayed = false;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.characteristic.Manufacturer, 'Eufy')
            .setCharacteristic(this.characteristic.Model, eufyStation.getModel())
            .setCharacteristic(this.characteristic.SerialNumber, eufyStation.getSerial())
            .setCharacteristic(this.characteristic.FirmwareRevision, eufyStation.getSoftwareVersion());
        this.service =
            this.accessory.getService(this.platform.Service.SecuritySystem) ||
                this.accessory.addService(this.platform.Service.SecuritySystem);
        this.service.setCharacteristic(this.characteristic.Name, accessory.displayName);
        // create handlers for required characteristics
        this.service
            .getCharacteristic(this.characteristic.SecuritySystemCurrentState)
            .onGet(this.handleSecuritySystemCurrentStateGet.bind(this));
        this.service
            .getCharacteristic(this.characteristic.SecuritySystemTargetState)
            .onGet(this.handleSecuritySystemTargetStateGet.bind(this))
            .onSet(this.handleSecuritySystemTargetStateSet.bind(this));
        this.manualTriggerService =
            this.accessory.getService(this.platform.Service.Switch) ||
                this.accessory.addService(this.platform.Service.Switch);
        this.manualTriggerService.setCharacteristic(this.characteristic.Name, accessory.displayName + ' alarm');
        // this.manualTriggerService.setCharacteristic(
        //   this.platform.Characteristic.ConfiguredName,
        //   accessory.displayName + ' alarm',
        // );
        this.manualTriggerService
            .getCharacteristic(this.characteristic.On)
            .onGet(this.handleManualTriggerSwitchStateGet.bind(this))
            .onSet(this.handleManualTriggerSwitchStateSet.bind(this));
        this.eufyStation.on('guard mode', (station, guardMode) => this.onStationGuardModePushNotification(station, guardMode));
        this.eufyStation.on('current mode', (station, currentMode) => this.onStationCurrentModePushNotification(station, currentMode));
        this.eufyStation.on('alarm event', (station, alarmEvent) => this.onStationAlarmEventPushNotification(station, alarmEvent));
        this.eufyStation.on('alarm arm delay event', this.onStationAlarmDelayedEvent.bind(this));
        this.eufyStation.on('alarm armed event', this.onStationAlarmArmedEvent.bind(this));
        if (this.platform.config.enableDetailedLogging) {
            this.eufyStation.on('raw property changed', (device, type, value) => this.handleRawPropertyChange(device, type, value));
            this.eufyStation.on('property changed', (device, name, value) => this.handlePropertyChange(device, name, value));
        }
        // warn user if station command returns with error
        this.eufyStation.on('command result', this.handleCommandResult.bind(this));
    }
    getStationConfig() {
        var _a, _b, _c, _d, _e;
        let config = {};
        if (typeof this.platform.config.stations !== 'undefined') {
            // eslint-disable-next-line prefer-arrow-callback, brace-style
            const pos = this.platform.config.stations.map(function (e) { return e.serialNumber; }).indexOf(this.station.getSerial());
            config = { ...this.platform.config.stations[pos] };
        }
        if (config.hkHome || this.platform.config.hkHome) {
            config.hkHome = (_a = config.hkHome) !== null && _a !== void 0 ? _a : (config.hkHome = this.platform.config.hkHome);
        }
        if (config.hkAway || this.platform.config.hkAway) {
            config.hkAway = (_b = config.hkAway) !== null && _b !== void 0 ? _b : (config.hkAway = this.platform.config.hkAway);
        }
        if (config.hkNight || this.platform.config.hkNight) {
            config.hkNight = (_c = config.hkNight) !== null && _c !== void 0 ? _c : (config.hkNight = this.platform.config.hkNight);
        }
        if (config.hkOff || this.platform.config.hkOff) {
            config.hkOff = (_d = config.hkOff) !== null && _d !== void 0 ? _d : (config.hkOff = this.platform.config.hkOff);
        }
        if (!Array.isArray(config.manualTriggerModes)) {
            config.manualTriggerModes = [];
        }
        this.platform.log.debug(this.accessory.displayName, 'manual alarm will be triggered only in these hk modes: ' + config.manualTriggerModes);
        config.manualAlarmSeconds = (_e = config.manualAlarmSeconds) !== null && _e !== void 0 ? _e : (config.manualAlarmSeconds = 30);
        return config;
    }
    onStationGuardModePushNotification(station, guardMode) {
        this.platform.log.debug(this.accessory.displayName, 'ON SecurityGuardMode:', guardMode);
        const homekitCurrentMode = this.convertEufytoHK(guardMode);
        this.service
            .getCharacteristic(this.characteristic.SecuritySystemTargetState)
            .updateValue(homekitCurrentMode);
    }
    onStationCurrentModePushNotification(station, currentMode) {
        if (this.guardModeChangeTimeout) {
            clearTimeout(this.guardModeChangeTimeout);
        }
        if (this.retryGuardModeChangeTimeout) {
            clearTimeout(this.retryGuardModeChangeTimeout);
        }
        this.platform.log.debug(this.accessory.displayName, 'ON SecuritySystemCurrentState:', currentMode);
        const homekitCurrentMode = this.convertEufytoHK(currentMode);
        this.service
            .getCharacteristic(this.characteristic.SecuritySystemCurrentState)
            .updateValue(homekitCurrentMode);
    }
    onStationAlarmEventPushNotification(station, alarmEvent) {
        let currentValue = this.eufyStation.getPropertyValue(eufy_security_client_1.PropertyName.StationCurrentMode);
        if (alarmEvent === 0) {
            // do not resset alarm if alarm was triggered manually
            // since the alarm can only be triggered for 30 seconds for now (limitation of eufy-security-client)
            // this would mean that the alarm is always reset after 30 seconds
            // see here: https://github.com/bropat/eufy-security-client/issues/178
            currentValue = -1;
        }
        switch (alarmEvent) {
            case 2: // Alarm triggered by GSENSOR
            case 3: // Alarm triggered by PIR
            case 4: // Alarm triggered by EUFY_APP
            case 6: // Alarm triggered by DOOR
            case 7: // Alarm triggered by CAMERA_PIR
            case 8: // Alarm triggered by MOTION_SENSOR
            case 9: // Alarm triggered by CAMERA_GSENSOR
                this.platform.log.warn('ON StationAlarmEvent - ALARM TRIGGERED - alarmEvent:', alarmEvent);
                this.alarm_triggered = true;
                this.service
                    .getCharacteristic(this.characteristic.SecuritySystemCurrentState)
                    .updateValue(this.characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED); // Alarm !!!
                break;
            case 0: // Alarm off by Hub
            case 15: // Alarm off by Keypad
            case 16: // Alarm off by Eufy App
            case 17: // Alarm off by HomeBase button
                this.platform.log.warn('ON StationAlarmEvent - ALARM OFF - alarmEvent:', alarmEvent);
                this.alarm_triggered = false;
                if (currentValue !== -1) {
                    this.service
                        .getCharacteristic(this.characteristic.SecuritySystemCurrentState)
                        .updateValue(this.convertEufytoHK(currentValue)); // reset alarm state
                }
                break;
            default:
                this.platform.log.warn('ON StationAlarmEvent - ALARM UNKNOWN - alarmEvent:', alarmEvent);
                this.service
                    .getCharacteristic(this.characteristic.StatusFault)
                    .updateValue(this.characteristic.StatusFault.GENERAL_FAULT);
                break;
        }
        this.manualTriggerService
            .getCharacteristic(this.characteristic.On)
            .updateValue(this.alarm_triggered);
    }
    mappingHKEufy() {
        var _a, _b, _c, _d;
        this.modes = [
            { hk: 0, eufy: (_a = this.stationConfig.hkHome) !== null && _a !== void 0 ? _a : 1 },
            { hk: 1, eufy: (_b = this.stationConfig.hkAway) !== null && _b !== void 0 ? _b : 0 },
            { hk: 2, eufy: (_c = this.stationConfig.hkNight) !== null && _c !== void 0 ? _c : 3 }, // Night
        ];
        // If a keypad attached to the station
        if (this.eufyStation.hasDeviceWithType(eufy_security_client_1.DeviceType.KEYPAD)) {
            this.modes.push({ hk: 3, eufy: (_d = this.stationConfig.hkOff) !== null && _d !== void 0 ? _d : 63 });
            this.modes.push({ hk: 3, eufy: ((this.modes.filter((m) => {
                    return m.eufy === 6;
                })[0]) ? 63 : 6) });
        }
        else if (this.stationConfig.hkOff !== undefined && this.stationConfig.hkOff !== null) {
            this.modes.push({
                hk: 3,
                eufy: (this.stationConfig.hkOff === 6) ? 63 : this.stationConfig.hkOff,
            }); // Enforce 63 if keypad has been selected but not attached to the station
        }
        else {
            this.modes.push({
                hk: 3,
                eufy: 63,
            }); // Enforce 63 if hkOff is not set
        }
        this.platform.log.debug(this.accessory.displayName, 'Mapping for station modes: ' + JSON.stringify(this.modes));
    }
    convertHKtoEufy(hkMode) {
        const modeObj = this.modes.filter((m) => {
            return m.hk === hkMode;
        });
        return parseInt(modeObj[0] ? modeObj[0].eufy : hkMode);
    }
    convertEufytoHK(eufyMode) {
        const modeObj = this.modes.filter((m) => {
            return m.eufy === eufyMode;
        });
        return parseInt(modeObj[0] ? modeObj[0].hk : eufyMode);
    }
    /**
     * Handle requests to get the current value of the 'Security System Current State' characteristic
     */
    async handleSecuritySystemCurrentStateGet() {
        if (this.alarm_triggered) {
            return this.characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
        }
        try {
            const currentValue = this.eufyStation.getPropertyValue(eufy_security_client_1.PropertyName.StationCurrentMode);
            if (currentValue === -1) {
                throw 'Something wrong with this device';
            }
            this.platform.log.debug(this.accessory.displayName, 'GET StationCurrentMode:', currentValue);
            return this.convertEufytoHK(currentValue);
        }
        catch (_a) {
            this.platform.log.error(this.accessory.displayName, 'handleSecuritySystemCurrentStateGet', 'Wrong return value');
            return false;
        }
    }
    /**
     * Handle requests to get the current value of the 'Security System Target State' characteristic
     */
    handleSecuritySystemTargetStateGet() {
        try {
            const currentValue = this.eufyStation.getPropertyValue(eufy_security_client_1.PropertyName.StationCurrentMode);
            if (currentValue === -1) {
                throw 'Something wrong with this device';
            }
            this.platform.log.debug(this.accessory.displayName, 'GET StationCurrentMode:', currentValue);
            return this.convertEufytoHK(currentValue);
        }
        catch (_a) {
            this.platform.log.error(this.accessory.displayName, 'handleSecuritySystemTargetStateGet', 'Wrong return value');
            return false;
        }
    }
    /**
     * Handle requests to set the 'Security System Target State' characteristic
     */
    handleSecuritySystemTargetStateSet(value) {
        try {
            this.alarm_triggered = false;
            this.platform.log.debug(this.accessory.displayName, 'SET StationGuardMode (raw value homekit):' + value);
            const mode = this.convertHKtoEufy(value);
            if (isNaN(mode)) {
                throw new Error(this.accessory.displayName + ': Could not convert guard mode value to valid number. Aborting guard mode change...');
            }
            this.platform.log.debug(this.accessory.displayName, 'SET StationGuardMode:' + mode);
            this.platform.log.info(this.accessory.displayName, 'Request to change station guard mode to: ' + this.getGuardModeName(value) + '.');
            const current = this.service.getCharacteristic(this.characteristic.SecuritySystemCurrentState).value;
            if (current !== value) {
                this.eufyStation.setGuardMode(mode);
                this.guardModeChangeTimeout = setTimeout(() => {
                    this.platform.log.warn(this.accessory.displayName, 'Changing guard mode to ' + this.getGuardModeName(value) + 'did not complete. Retry...');
                    this.eufyStation.setGuardMode(mode);
                    this.retryGuardModeChangeTimeout = setTimeout(() => {
                        this.platform.log.error(this.accessory.displayName, 'Changing guard mode to ' + this.getGuardModeName(value) + ' timed out!');
                    }, 5000);
                }, 5000);
            }
            else {
                this.platform.log.info(this.accessory.displayName, 'station was already set to :' + this.getGuardModeName(value));
            }
            this.manualTriggerService
                .getCharacteristic(this.characteristic.On)
                .updateValue(false);
            if (!this.dontSync && this.platform.config.syncStationModes) {
                this.dontSync = false;
                // try to sync all stations
                this.platform.log.info(this.accessory.displayName, 'syncing guard mode with other stations');
                this.platform.getStationAccessories().forEach(stationAccessory => {
                    if (stationAccessory.getStationSerial() !== this.getStationSerial()) {
                        this.platform.log.debug(this.accessory.displayName, 'syncing station (' + stationAccessory.getStationSerial() + ').');
                        stationAccessory.syncStationMode(value);
                    }
                });
            }
        }
        catch (error) {
            this.platform.log.error(this.accessory.displayName + ': Error Setting security mode!', error);
        }
    }
    handleManualTriggerSwitchStateGet() {
        return this.alarm_triggered;
    }
    async handleManualTriggerSwitchStateSet(value) {
        if (value) { // trigger alarm
            try {
                const currentValue = this.eufyStation.getPropertyValue(eufy_security_client_1.PropertyName.StationCurrentMode);
                if (currentValue === -1) {
                    throw 'Something wrong with this device';
                }
                // check if alarm is allowed for this guard mode
                // and alarm is not delayed
                if (this.stationConfig.manualTriggerModes.indexOf(this.convertEufytoHK(currentValue)) !== -1 && !this.alarm_delayed) {
                    this.eufyStation.triggerStationAlarmSound(this.stationConfig.manualAlarmSeconds)
                        .then(() => this.platform.log.debug(this.accessory.displayName, 'alarm manually triggered for ' + this.stationConfig.manualAlarmSeconds + ' seconds.'))
                        .catch(err => this.platform.log.error(this.accessory.displayName, 'alarm could not be manually triggered: ' + err));
                }
                else {
                    const message = this.alarm_delayed ?
                        'tried to trigger alarm, but the alarm delayed event was triggered beforehand.' :
                        'tried to trigger alarm, but the current station mode prevents the alarm from being triggered. ' +
                            'Please look in in the configuration if you want to change this behaviour.';
                    setTimeout(() => {
                        this.platform.log.info(this.accessory.displayName, message);
                        this.manualTriggerService
                            .getCharacteristic(this.characteristic.On)
                            .updateValue(false);
                    }, 1000);
                }
            }
            catch (_a) {
                this.platform.log.error(this.accessory.displayName, 'handleSecuritySystemTargetStateGet', 'Wrong return value');
                return;
            }
        }
        else { // reset alarm
            this.eufyStation.resetStationAlarmSound()
                .then(() => this.platform.log.debug(this.accessory.displayName, 'alarm manually reset'))
                .catch(err => this.platform.log.error(this.accessory.displayName, 'alarm could not be reset: ' + err));
        }
    }
    onStationAlarmDelayedEvent(station, armDelay) {
        this.platform.log.debug(this.accessory.displayName, `alarm for this station will be delayed by ${armDelay} seconds.`);
        this.alarm_delayed = true;
        if (this.alarm_delay_timeout) {
            clearTimeout(this.alarm_delay_timeout);
        }
        this.alarm_delay_timeout = setTimeout(() => {
            this.platform.log.debug(this.accessory.displayName, 'alarm for this station is armed now (due to timeout).');
            this.alarm_delayed = false;
        }, (armDelay + 1) * 1000);
    }
    onStationAlarmArmedEvent(station) {
        this.platform.log.debug(this.accessory.displayName, 'alarm for this station is armed now.');
        this.alarm_delayed = false;
        if (this.alarm_delay_timeout) {
            clearTimeout(this.alarm_delay_timeout);
        }
    }
    syncStationMode(mode) {
        this.dontSync = true;
        this.service
            .getCharacteristic(this.characteristic.SecuritySystemTargetState)
            .setValue(mode);
    }
    getStationSerial() {
        return this.station.getSerial();
    }
    getGuardModeName(value) {
        try {
            return this.hkStateNames[value];
        }
        catch (error) {
            return 'Unknown';
        }
    }
    handleRawPropertyChange(device, type, value) {
        this.platform.log.debug(this.accessory.displayName, 'ON handleRawPropertyChange:', {
            type,
            value,
        });
    }
    handlePropertyChange(device, name, value) {
        this.platform.log.debug(this.accessory.displayName, 'ON handlePropertyChange:', {
            name,
            value,
        });
    }
    handleCommandResult(station, result) {
        if (result.return_code !== eufy_security_client_1.ErrorCode.ERROR_PPCS_SUCCESSFUL) {
            const resultErrors = [
                eufy_security_client_1.ErrorCode.ERROR_COMMAND_TIMEOUT,
                eufy_security_client_1.ErrorCode.ERROR_CONNECT_TIMEOUT,
                eufy_security_client_1.ErrorCode.ERROR_DEV_BUSY,
                eufy_security_client_1.ErrorCode.ERROR_DEV_CLOSE,
                eufy_security_client_1.ErrorCode.ERROR_DEV_OFFLINE,
                eufy_security_client_1.ErrorCode.ERROR_FAILED_TO_REQUEST,
                eufy_security_client_1.ErrorCode.ERROR_INVALID_ACCOUNT,
                eufy_security_client_1.ErrorCode.ERROR_INVALID_COMMAND,
                eufy_security_client_1.ErrorCode.ERROR_NETWORK_NOT_AVAILABLE,
                eufy_security_client_1.ErrorCode.ERROR_WAIT_TIMEOUT,
            ];
            if (resultErrors.indexOf(result.return_code) !== -1) {
                // eslint-disable-next-line max-len
                this.platform.log.error(`station ${this.accessory.displayName} (${station.getSerial()}) experienced an Error: ${eufy_security_client_1.ErrorCode[result.return_code]} (${result.return_code}) | (command: ${result.command_type})`);
            }
            else {
                // eslint-disable-next-line max-len
                this.platform.log.warn(`station ${this.accessory.displayName} (${station.getSerial()}) experienced a command return code error: ${eufy_security_client_1.ErrorCode[result.return_code]} (${result.return_code}) (command: ${result.command_type})`);
            }
        }
    }
}
exports.StationAccessory = StationAccessory;
//# sourceMappingURL=StationAccessory.js.map