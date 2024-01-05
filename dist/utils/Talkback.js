"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TalkbackStream = void 0;
const stream_1 = require("stream");
class TalkbackStream extends stream_1.Duplex {
    constructor(platform, camera) {
        super();
        this.cacheData = [];
        this.talkbackStarted = false;
        this.talkbackStartedHandle = (station, device, stream) => {
            this.onTalkbackStarted(station, device, stream);
        };
        this.talkbackStoppedHandle = (station, device) => {
            this.onTalkbackStopped(station, device);
        };
        this.platform = platform;
        this.camera = camera;
        this.platform.eufyClient.on('station talkback start', this.talkbackStartedHandle);
        this.platform.eufyClient.on('station talkback stop', this.talkbackStoppedHandle);
    }
    onTalkbackStarted(station, device, stream) {
        if (device.getSerial() !== this.camera.getSerial()) {
            return;
        }
        this.platform.log.debug(this.camera.getName(), 'talkback started event from station ' + station.getName());
        if (this.targetStream) {
            this.unpipe(this.targetStream);
        }
        this.targetStream = stream;
        this.pipe(this.targetStream);
    }
    onTalkbackStopped(station, device) {
        if (device.getSerial() !== this.camera.getSerial()) {
            return;
        }
        this.platform.log.debug(this.camera.getName(), 'talkback stopped event from station ' + station.getName());
        if (this.targetStream) {
            this.unpipe(this.targetStream);
        }
        this.targetStream = undefined;
    }
    stopTalkbackStream() {
        // remove event listeners
        this.platform.eufyClient.removeListener('station talkback start', this.talkbackStartedHandle);
        this.platform.eufyClient.removeListener('station talkback stop', this.talkbackStoppedHandle);
        this.stopTalkback();
        this.unpipe();
        this.destroy();
    }
    _read(size) {
        let pushReturn = true;
        while (this.cacheData.length > 0 && pushReturn) {
            const data = this.cacheData.shift();
            pushReturn = this.push(data);
        }
    }
    _write(chunk, encoding, callback) {
        if (this.stopTalkbackTimeout) {
            clearTimeout(this.stopTalkbackTimeout);
        }
        this.stopTalkbackTimeout = setTimeout(() => {
            this.stopTalkback();
        }, 2000);
        if (this.targetStream) {
            this.push(chunk);
        }
        else {
            this.cacheData.push(chunk);
            this.startTalkback();
        }
        callback();
    }
    startTalkback() {
        if (!this.talkbackStarted) {
            this.talkbackStarted = true;
            this.platform.log.debug(this.camera.getName(), 'starting talkback');
            this.platform.eufyClient.startStationTalkback(this.camera.getSerial())
                .catch(err => {
                this.platform.log.error(this.camera.getName(), 'talkback could not be started: ' + err);
            });
        }
    }
    stopTalkback() {
        if (this.talkbackStarted) {
            this.talkbackStarted = false;
            this.platform.log.debug(this.camera.getName(), 'stopping talkback');
            this.platform.eufyClient.stopStationTalkback(this.camera.getSerial())
                .catch(err => {
                this.platform.log.error(this.camera.getName(), 'talkback could not be stopped: ' + err);
            });
        }
    }
}
exports.TalkbackStream = TalkbackStream;
//# sourceMappingURL=Talkback.js.map