"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalLivestreamManager = void 0;
const stream_1 = require("stream");
class AudiostreamProxy extends stream_1.Readable {
    constructor(log) {
        super();
        this.cacheData = [];
        this.pushNewDataImmediately = false;
        this.dataFramesCount = 0;
        this.log = log;
    }
    transmitData(data) {
        this.dataFramesCount++;
        return this.push(data);
    }
    newAudioData(data) {
        if (this.pushNewDataImmediately) {
            this.pushNewDataImmediately = false;
            this.transmitData(data);
        }
        else {
            this.cacheData.push(data);
        }
    }
    stopProxyStream() {
        this.log.debug('Audiostream was stopped after transmission of ' + this.dataFramesCount + ' data chunks.');
        this.unpipe();
        this.destroy();
    }
    _read(size) {
        let pushReturn = true;
        while (this.cacheData.length > 0 && pushReturn) {
            const data = this.cacheData.shift();
            pushReturn = this.transmitData(data);
        }
        if (pushReturn) {
            this.pushNewDataImmediately = true;
        }
    }
}
class VideostreamProxy extends stream_1.Readable {
    constructor(id, manager, log) {
        super();
        this.cacheData = [];
        this.killTimeout = null;
        this.pushNewDataImmediately = false;
        this.dataFramesCount = 0;
        this.livestreamId = id;
        this.manager = manager;
        this.log = log;
        this.resetKillTimeout();
    }
    transmitData(data) {
        this.dataFramesCount++;
        return this.push(data);
    }
    newVideoData(data) {
        if (this.pushNewDataImmediately) {
            this.pushNewDataImmediately = false;
            try {
                if (this.transmitData(data)) {
                    this.resetKillTimeout();
                }
            }
            catch (err) {
                this.log.debug('Push of new data was not succesful. Most likely the target process (ffmpeg) was already terminated. Error: ' + err);
            }
        }
        else {
            this.cacheData.push(data);
        }
    }
    stopProxyStream() {
        this.log.debug('Videostream was stopped after transmission of ' + this.dataFramesCount + ' data chunks.');
        this.unpipe();
        this.destroy();
        if (this.killTimeout) {
            clearTimeout(this.killTimeout);
        }
    }
    resetKillTimeout() {
        if (this.killTimeout) {
            clearTimeout(this.killTimeout);
        }
        this.killTimeout = setTimeout(() => {
            this.log.warn('Proxy Stream (id: ' + this.livestreamId + ') was terminated due to inactivity. (no data transmitted in 15 seconds)');
            this.manager.stopProxyStream(this.livestreamId);
        }, 15000);
    }
    _read(size) {
        this.resetKillTimeout();
        let pushReturn = true;
        while (this.cacheData.length > 0 && pushReturn) {
            const data = this.cacheData.shift();
            pushReturn = this.transmitData(data);
        }
        if (pushReturn) {
            this.pushNewDataImmediately = true;
        }
    }
}
class LocalLivestreamManager extends stream_1.EventEmitter {
    constructor(platform, device, log) {
        super();
        this.SECONDS_UNTIL_TERMINATION_AFTER_LAST_USED = 45;
        this.CONNECTION_ESTABLISHED_TIMEOUT = 5;
        this.livestreamCount = 1;
        this.proxyStreams = new Set();
        this.livestreamIsStarting = false;
        this.log = log;
        this.platform = platform;
        this.device = device;
        this.stationStream = null;
        this.livestreamStartedAt = null;
        this.initialize();
        this.platform.eufyClient.on('station livestream stop', (station, device) => {
            this.onStationLivestreamStop(station, device);
        });
        this.platform.eufyClient.on('station livestream start', (station, device, metadata, videostream, audiostream) => {
            this.onStationLivestreamStart(station, device, metadata, videostream, audiostream);
        });
    }
    initialize() {
        if (this.stationStream) {
            this.stationStream.audiostream.unpipe();
            this.stationStream.audiostream.destroy();
            this.stationStream.videostream.unpipe();
            this.stationStream.videostream.destroy();
        }
        this.stationStream = null;
        this.livestreamStartedAt = null;
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
        }
    }
    async getLocalLivestream() {
        this.log.debug(this.device.getName(), 'New instance requests livestream. There were ' +
            this.proxyStreams.size + ' instance(s) using the livestream until now.');
        if (this.terminationTimeout) {
            clearTimeout(this.terminationTimeout);
        }
        const proxyStream = await this.getProxyStream();
        if (proxyStream) {
            const runtime = (Date.now() - this.livestreamStartedAt) / 1000;
            this.log.debug(this.device.getName(), 'Using livestream that was started ' + runtime + ' seconds ago. The proxy stream has id: ' + proxyStream.id + '.');
            return proxyStream;
        }
        else {
            return await this.startAndGetLocalLiveStream();
        }
    }
    async startAndGetLocalLiveStream() {
        return new Promise((resolve, reject) => {
            this.log.debug(this.device.getName(), 'Start new station livestream (P2P Session)...');
            if (!this.livestreamIsStarting) { // prevent multiple stream starts from eufy station
                this.livestreamIsStarting = true;
                this.platform.eufyClient.startStationLivestream(this.device.getSerial());
            }
            else {
                this.log.debug(this.device.getName(), 'stream is already starting. waiting...');
            }
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
            }
            this.connectionTimeout = setTimeout(() => {
                this.livestreamIsStarting = false;
                this.log.error(this.device.getName(), 'Local livestream didn\'t start in time. Abort livestream request.');
                reject('no started livestream found');
            }, this.CONNECTION_ESTABLISHED_TIMEOUT * 2000);
            this.once('livestream start', async () => {
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                }
                const proxyStream = await this.getProxyStream();
                if (proxyStream !== null) {
                    this.log.debug(this.device.getName(), 'New livestream started. Proxy stream has id: ' + proxyStream.id + '.');
                    this.livestreamIsStarting = false;
                    resolve(proxyStream);
                }
                else {
                    reject('no started livestream found');
                }
            });
        });
    }
    scheduleLivestreamCacheTermination(streamingTimeLeft) {
        // eslint-disable-next-line max-len
        const terminationTime = ((streamingTimeLeft - this.SECONDS_UNTIL_TERMINATION_AFTER_LAST_USED) > 20) ? this.SECONDS_UNTIL_TERMINATION_AFTER_LAST_USED : streamingTimeLeft - 20;
        this.log.debug(this.device.getName(), 'Schedule livestream termination in ' + terminationTime + ' seconds.');
        if (this.terminationTimeout) {
            clearTimeout(this.terminationTimeout);
        }
        this.terminationTimeout = setTimeout(() => {
            if (this.proxyStreams.size <= 0) {
                this.stopLocalLiveStream();
            }
        }, terminationTime * 1000);
    }
    stopLocalLiveStream() {
        this.log.debug(this.device.getName(), 'Stopping station livestream.');
        this.platform.eufyClient.stopStationLivestream(this.device.getSerial());
        this.initialize();
    }
    onStationLivestreamStop(station, device) {
        if (device.getSerial() === this.device.getSerial()) {
            this.log.info(station.getName() + ' station livestream for ' + device.getName() + ' has stopped.');
            this.proxyStreams.forEach((proxyStream) => {
                proxyStream.audiostream.stopProxyStream();
                proxyStream.videostream.stopProxyStream();
                this.removeProxyStream(proxyStream.id);
            });
            this.initialize();
        }
    }
    async onStationLivestreamStart(station, device, metadata, videostream, audiostream) {
        if (device.getSerial() === this.device.getSerial()) {
            if (this.stationStream) {
                const diff = (Date.now() - this.stationStream.createdAt) / 1000;
                if (diff < 5) {
                    this.log.warn(this.device.getName(), 'Second livestream was started from station. Ignore.');
                    return;
                }
            }
            this.initialize(); // important to prevent unwanted behaviour when the eufy station emits the 'livestream start' event multiple times
            videostream.on('data', (data) => {
                this.proxyStreams.forEach((proxyStream) => {
                    proxyStream.videostream.newVideoData(data);
                });
            });
            videostream.on('error', (error) => {
                this.log.error(this.device.getName(), 'Local videostream had Error: ' + error);
                this.stopAllProxyStreams();
                this.stopLocalLiveStream();
            });
            videostream.on('end', () => {
                this.log.debug(this.device.getName(), 'Local videostream has ended. Clean up.');
                this.stopAllProxyStreams();
                this.stopLocalLiveStream();
            });
            audiostream.on('data', (data) => {
                this.proxyStreams.forEach((proxyStream) => {
                    proxyStream.audiostream.newAudioData(data);
                });
            });
            audiostream.on('error', (error) => {
                this.log.error(this.device.getName(), 'Local audiostream had Error: ' + error);
                this.stopAllProxyStreams();
                this.stopLocalLiveStream();
            });
            audiostream.on('end', () => {
                this.log.debug(this.device.getName(), 'Local audiostream has ended. Clean up.');
                this.stopAllProxyStreams();
                this.stopLocalLiveStream();
            });
            this.log.info(station.getName() + ' station livestream (P2P session) for ' + device.getName() + ' has started.');
            this.livestreamStartedAt = Date.now();
            const createdAt = Date.now();
            this.stationStream = { station, device, metadata, videostream, audiostream, createdAt };
            this.log.debug(this.device.getName(), 'Stream metadata: ' + JSON.stringify(this.stationStream.metadata));
            this.emit('livestream start');
        }
    }
    getProxyStream() {
        if (this.stationStream) {
            const id = this.livestreamCount;
            this.livestreamCount++;
            if (this.livestreamCount > 1024) {
                this.livestreamCount = 1;
            }
            const videostream = new VideostreamProxy(id, this, this.log);
            const audiostream = new AudiostreamProxy(this.log);
            const proxyStream = { id, videostream, audiostream };
            this.proxyStreams.add(proxyStream);
            return proxyStream;
        }
        else {
            return null;
        }
    }
    stopProxyStream(id) {
        this.proxyStreams.forEach((pStream) => {
            if (pStream.id === id) {
                pStream.audiostream.stopProxyStream();
                pStream.videostream.stopProxyStream();
                this.removeProxyStream(id);
            }
        });
    }
    stopAllProxyStreams() {
        this.proxyStreams.forEach((proxyStream) => {
            this.stopProxyStream(proxyStream.id);
        });
    }
    removeProxyStream(id) {
        let proxyStream = null;
        this.proxyStreams.forEach((pStream) => {
            if (pStream.id === id) {
                proxyStream = pStream;
            }
        });
        if (proxyStream !== null) {
            this.proxyStreams.delete(proxyStream);
            this.log.debug(this.device.getName(), 'One stream instance (id: ' + id + ') released livestream. There are now ' +
                this.proxyStreams.size + ' instance(s) using the livestream.');
            if (this.proxyStreams.size === 0) {
                this.log.debug(this.device.getName(), 'All proxy instances to the livestream have terminated.');
                this.stopLocalLiveStream();
            }
        }
    }
}
exports.LocalLivestreamManager = LocalLivestreamManager;
//# sourceMappingURL=LocalLivestreamManager.js.map