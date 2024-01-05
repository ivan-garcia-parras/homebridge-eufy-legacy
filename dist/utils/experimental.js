"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRTSPCapability = exports.initializeExperimentalMode = void 0;
const eufy_security_client_1 = require("eufy-security-client");
const initializeExperimentalMode = () => {
    addRTSPPropertiesToAllDevices();
};
exports.initializeExperimentalMode = initializeExperimentalMode;
eufy_security_client_1.PropertyName['ExperimentalModification'] = 'experimentalModification';
const DeviceExperimentalModification = {
    key: 0,
    name: eufy_security_client_1.PropertyName['ExperimentalModification'],
    label: 'Experimental Modification',
    readable: true,
    writeable: false,
    type: 'boolean',
};
const addRTSPPropertiesToAllDevices = () => {
    const deviceTypes = Object.values(eufy_security_client_1.DeviceType).filter(t => !isNaN(Number(t)));
    deviceTypes.forEach(deviceType => addRTSPPropertiesToDevice(deviceType));
};
const addRTSPPropertiesToDevice = (deviceType) => {
    let changed = false;
    if (eufy_security_client_1.DeviceProperties[deviceType] && !eufy_security_client_1.DeviceProperties[deviceType][eufy_security_client_1.PropertyName.DeviceRTSPStream]) {
        eufy_security_client_1.DeviceProperties[deviceType] = {
            ...eufy_security_client_1.DeviceProperties[deviceType],
            [eufy_security_client_1.PropertyName.DeviceRTSPStream]: eufy_security_client_1.DeviceRTSPStreamProperty,
        };
        changed = true;
    }
    if (eufy_security_client_1.DeviceProperties[deviceType] && !eufy_security_client_1.DeviceProperties[deviceType][eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl]) {
        eufy_security_client_1.DeviceProperties[deviceType] = {
            ...eufy_security_client_1.DeviceProperties[deviceType],
            [eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl]: eufy_security_client_1.DeviceRTSPStreamUrlProperty,
        };
        changed = true;
    }
    if (changed && eufy_security_client_1.DeviceProperties[deviceType] && !eufy_security_client_1.DeviceProperties[deviceType][eufy_security_client_1.PropertyName['ExperimentalModification']]) {
        eufy_security_client_1.DeviceProperties[deviceType] = {
            ...eufy_security_client_1.DeviceProperties[deviceType],
            [eufy_security_client_1.PropertyName['ExperimentalModification']]: DeviceExperimentalModification,
        };
    }
};
const setRTSPCapability = (station, device, value) => {
    station.setRTSPStream(device, value);
};
exports.setRTSPCapability = setRTSPCapability;
//# sourceMappingURL=experimental.js.map