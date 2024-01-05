"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.is_rtsp_ready = void 0;
const eufy_security_client_1 = require("eufy-security-client");
const is_rtsp_ready = function (device, cameraConfig, log) {
    log.debug(device.getName(), 'RTSP rtspStream:' + JSON.stringify(device.hasProperty('rtspStream')));
    if (!device.hasProperty('rtspStream')) {
        log.debug(device.getName(), 'Looks like not compatible with RTSP');
        return false;
    }
    log.debug(device.getName(), 'RTSP cameraConfig: ' + JSON.stringify(cameraConfig.rtsp));
    if (!cameraConfig.rtsp) {
        log.debug(device.getName(), 'Looks like RTSP is not enabled on camera config');
        return false;
    }
    log.debug(device.getName(), 'RTSP ' + JSON.stringify(device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStream)));
    if (!device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStream)) {
        log.debug(device.getName(), ': RTSP capabilities not enabled. You will need to do it manually!');
        return false;
    }
    log.debug(device.getName(), 'RTSP ' + JSON.stringify(device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl)));
    if (device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl) === '') {
        log.debug(device.getName(), ': RTSP URL is unknow');
        return false;
    }
    return true;
};
exports.is_rtsp_ready = is_rtsp_ready;
//# sourceMappingURL=utils.js.map