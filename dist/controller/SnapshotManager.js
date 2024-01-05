"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotManager = void 0;
const https_1 = __importDefault(require("https"));
const fs_1 = require("fs");
const stream_1 = require("stream");
const eufy_security_client_1 = require("eufy-security-client");
const ffmpeg_for_homebridge_1 = __importDefault(require("ffmpeg-for-homebridge"));
const utils_1 = require("../utils/utils");
const ffmpeg_1 = require("../utils/ffmpeg");
const SnapshotBlackPath = require.resolve('../../media/Snapshot-black.png');
let MINUTES_TO_WAIT_FOR_AUTOMATIC_REFRESH_TO_BEGIN = 1; // should be incremented by 1 for every device
/**
 * possible performance settings:
 * 1. snapshots as current as possible (weak homebridge performance) -> forceRefreshSnapshot
 *    - always get a new image from cloud or cam
 * 2. balanced
 *    - start snapshot refresh but return snapshot as fast as possible
 *      if request takes too long old snapshot will be returned
 * 3. get an old snapshot immediately -> !forceRefreshSnapshot
 *    - wait on cloud snapshot with new events
 *
 * extra options:
 *  - force refresh snapshots with interval
 *  - force immediate snapshot-reject when ringing
 *
 * Drawbacks: elapsed time in homekit might be wrong
 */
class SnapshotManager extends stream_1.EventEmitter {
    // eslint-disable-next-line max-len
    constructor(platform, device, cameraConfig, livestreamManager, log) {
        super();
        this.videoProcessor = ffmpeg_for_homebridge_1.default || 'ffmpeg';
        this.refreshProcessRunning = false;
        this.lastEvent = 0;
        this.lastRingEvent = 0;
        this.lastPictureUrlChanged = 0;
        this.log = log;
        this.platform = platform;
        this.device = device;
        this.cameraConfig = cameraConfig;
        this.livestreamManager = livestreamManager;
        this.device.on('property changed', this.onPropertyValueChanged.bind(this));
        this.device.on('crying detected', (device, state) => this.onEvent(device, state));
        this.device.on('motion detected', (device, state) => this.onEvent(device, state));
        this.device.on('person detected', (device, state) => this.onEvent(device, state));
        this.device.on('pet detected', (device, state) => this.onEvent(device, state));
        this.device.on('sound detected', (device, state) => this.onEvent(device, state));
        this.device.on('rings', (device, state) => this.onRingEvent(device, state));
        if (this.cameraConfig.refreshSnapshotIntervalMinutes) {
            if (this.cameraConfig.refreshSnapshotIntervalMinutes < 5) {
                this.log.warn(this.device.getName(), 'The interval to automatically refresh snapshots is set too low. Minimum is one minute.');
                this.cameraConfig.refreshSnapshotIntervalMinutes = 5;
            }
            // eslint-disable-next-line max-len
            this.log.info(this.device.getName(), 'Setting up automatic snapshot refresh every ' + this.cameraConfig.refreshSnapshotIntervalMinutes + ' minutes. This may decrease battery life dramatically. The refresh process for ' + this.device.getName() + ' should begin in ' + MINUTES_TO_WAIT_FOR_AUTOMATIC_REFRESH_TO_BEGIN + ' minutes.');
            setTimeout(() => {
                this.automaticSnapshotRefresh();
            }, MINUTES_TO_WAIT_FOR_AUTOMATIC_REFRESH_TO_BEGIN * 60 * 1000);
            MINUTES_TO_WAIT_FOR_AUTOMATIC_REFRESH_TO_BEGIN++;
        }
        if (this.cameraConfig.snapshotHandlingMethod === 1) {
            // eslint-disable-next-line max-len
            this.log.info(this.device.getName(), 'is set to generate new snapshots on events every time. This might reduce homebridge performance and increase power consumption.');
            if (this.cameraConfig.refreshSnapshotIntervalMinutes) {
                // eslint-disable-next-line max-len
                this.log.warn(this.device.getName(), 'You have enabled automatic snapshot refreshing. It is recommened not to use this setting with forced snapshot refreshing.');
            }
        }
        else if (this.cameraConfig.snapshotHandlingMethod === 2) {
            this.log.info(this.device.getName(), 'is set to balanced snapshot handling.');
        }
        else if (this.cameraConfig.snapshotHandlingMethod === 3) {
            this.log.info(this.device.getName(), 'is set to handle snapshots with cloud images. Snapshots might be older than they appear.');
        }
        else {
            this.log.warn(this.device.getName(), 'unknown snapshot handling method. SNapshots will not be generated.');
        }
        try {
            this.blackSnapshot = (0, fs_1.readFileSync)(SnapshotBlackPath);
            if (this.cameraConfig.immediateRingNotificationWithoutSnapshot) {
                this.log.info(this.device.getName(), 'Empty snapshot will be sent on ring events immediately to speed up homekit notifications.');
            }
        }
        catch (err) {
            this.log.error(this.device.getName(), 'could not cache black snapshot file for further use: ' + err);
        }
        this.getSnapshotFromCloud() // get current cloud snapshot for balanced mode scenarios -> first snapshot can be resolved
            .catch(err => this.log.warn(this.device.getName(), 'snapshot handler is initialized without cloud snapshot. Maybe no snapshot will displayed the first times.'));
    }
    onRingEvent(device, state) {
        if (state) {
            this.log.debug(this.device.getName(), 'Snapshot handler detected ring event.');
            this.lastRingEvent = Date.now();
        }
    }
    onEvent(device, state) {
        if (state) {
            this.log.debug(this.device.getName(), 'Snapshot handler detected event.');
            this.lastEvent = Date.now();
        }
    }
    async getSnapshotBuffer(request) {
        // return a new snapshot it it is recent enough (not more than 15 seconds)
        if (this.currentSnapshot) {
            const diff = Math.abs((Date.now() - this.currentSnapshot.timestamp) / 1000);
            if (diff <= 15) {
                this.log.debug(this.device.getName(), `returning snapshot that is just ${diff} seconds old.`);
                return this.resizeSnapshot(this.currentSnapshot.image, request);
            }
        }
        const diff = (Date.now() - this.lastRingEvent) / 1000;
        if (this.cameraConfig.immediateRingNotificationWithoutSnapshot && diff < 5) {
            this.log.debug(this.device.getName(), 'Sending empty snapshot to speed up homekit notification for ring event.');
            if (this.blackSnapshot) {
                return this.resizeSnapshot(this.blackSnapshot, request);
            }
            else {
                return Promise.reject('Prioritize ring notification over snapshot request. But could not supply empty snapshot.');
            }
        }
        let snapshot = Buffer.from([]);
        try {
            if (this.cameraConfig.snapshotHandlingMethod === 1) {
                // return a preferablly most recent snapshot every time
                this.log.debug(this.device.getName(), 'trying to get newest possible snapshot from camera.');
                snapshot = await this.getNewestSnapshotBuffer();
            }
            else if (this.cameraConfig.snapshotHandlingMethod === 2) {
                // balanced method
                this.log.debug(this.device.getName(), 'trying to get snapshot from camera with balanced method.');
                snapshot = await this.getBalancedSnapshot();
            }
            else if (this.cameraConfig.snapshotHandlingMethod === 3) {
                // fastest method with potentially old snapshots
                this.log.debug(this.device.getName(), 'trying to return cloud snapshot.');
                snapshot = await this.getNewestCloudSnapshot();
            }
            else {
                return Promise.reject('No suitable handling method for snapshots defined');
            }
            return this.resizeSnapshot(snapshot, request);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    async getNewestSnapshotBuffer() {
        return new Promise((resolve, reject) => {
            this.fetchCurrentCameraSnapshot().catch((err) => reject(err));
            const requestTimeout = setTimeout(() => {
                reject('snapshot request timed out');
            }, 15000);
            this.once('new snapshot', () => {
                if (requestTimeout) {
                    clearTimeout(requestTimeout);
                }
                if (this.currentSnapshot) {
                    resolve(this.currentSnapshot.image);
                }
                else {
                    reject('Unknown snapshot request error');
                }
            });
        });
    }
    async getBalancedSnapshot() {
        return new Promise((resolve, reject) => {
            let snapshotTimeout = setTimeout(() => {
                if (this.currentSnapshot) {
                    resolve(this.currentSnapshot.image);
                }
                else {
                    reject('No snapshot in memory');
                }
            }, 1000);
            this.fetchCurrentCameraSnapshot().catch((err) => this.log.warn(this.device.getName(), err));
            const newestEvent = (this.lastRingEvent > this.lastEvent) ? this.lastRingEvent : this.lastEvent;
            const diff = (Date.now() - newestEvent) / 1000;
            if (diff < 15) { // wait for cloud or camera snapshot
                this.log.debug(this.device.getName(), 'Waiting on cloud or camera snapshot...');
                if (snapshotTimeout) {
                    clearTimeout(snapshotTimeout);
                }
                snapshotTimeout = setTimeout(() => {
                    if (this.currentSnapshot) {
                        resolve(this.currentSnapshot.image);
                    }
                    else {
                        reject('No snapshot in memory');
                    }
                }, 15000);
            }
            this.once('new snapshot', () => {
                if (snapshotTimeout) {
                    clearTimeout(snapshotTimeout);
                }
                if (this.currentSnapshot) {
                    resolve(this.currentSnapshot.image);
                }
                else {
                    reject('No snapshot in memory');
                }
            });
        });
    }
    async getNewestCloudSnapshot() {
        return new Promise((resolve, reject) => {
            const newestEvent = (this.lastRingEvent > this.lastEvent) ? this.lastRingEvent : this.lastEvent;
            const diff = (Date.now() - newestEvent) / 1000;
            if (diff < 15) { // wait for cloud snapshot
                this.log.debug(this.device.getName(), 'Waiting on cloud snapshot...');
                const snapshotTimeout = setTimeout(() => {
                    reject('No snapshot has been retrieved in time from eufy cloud.');
                }, 15000);
                const pictureUrlTimeout = setTimeout(() => {
                    const diff = (Date.now() - this.lastPictureUrlChanged) / 1000;
                    if (diff > 5) {
                        // eslint-disable-next-line max-len
                        this.log.debug(this.device.getName(), 'There was no new cloud snapshot announced in time, although an event occured. Trying to return last cloud snapshot.');
                        if (this.currentSnapshot) {
                            resolve(this.currentSnapshot.image);
                        }
                        else {
                            reject('No snapshot in memory');
                        }
                    }
                }, 2500);
                this.once('new snapshot', () => {
                    if (snapshotTimeout) {
                        clearTimeout(snapshotTimeout);
                    }
                    if (pictureUrlTimeout) {
                        clearTimeout(pictureUrlTimeout);
                    }
                    if (this.currentSnapshot) {
                        resolve(this.currentSnapshot.image);
                    }
                    else {
                        reject('No snapshot in memory');
                    }
                });
            }
            else {
                if (this.currentSnapshot) {
                    resolve(this.currentSnapshot.image);
                }
                else {
                    reject('No snapshot in memory');
                }
            }
        });
    }
    automaticSnapshotRefresh() {
        this.log.debug(this.device.getName(), 'Automatic snapshot refresh triggered.');
        this.fetchCurrentCameraSnapshot().catch((err) => this.log.warn(this.device.getName(), err));
        if (this.snapshotRefreshTimer) {
            clearTimeout(this.snapshotRefreshTimer);
        }
        if (this.cameraConfig.refreshSnapshotIntervalMinutes) {
            this.snapshotRefreshTimer = setTimeout(() => {
                this.automaticSnapshotRefresh();
            }, this.cameraConfig.refreshSnapshotIntervalMinutes * 60 * 1000);
        }
    }
    async onPropertyValueChanged(device, name, value) {
        if (name === 'pictureUrl') {
            this.lastPictureUrlChanged = Date.now();
            this.handlePictureUrl(value);
        }
    }
    async getSnapshotFromCloud() {
        try {
            const url = this.device.getPropertyValue(eufy_security_client_1.PropertyName.DevicePictureUrl);
            this.log.debug(this.device.getName(), 'trying to download latest cloud snapshot for future use from: ' + url);
            const snapshot = await this.downloadImageData(url, 0);
            if (!this.lastCloudSnapshot && !this.currentSnapshot) {
                this.lastCloudSnapshot = {
                    // eslint-disable-next-line max-len
                    timestamp: Date.now() - 60 * 60 * 1000,
                    image: snapshot.image,
                    sourceUrl: url,
                };
                this.currentSnapshot = this.lastCloudSnapshot;
                this.log.debug(this.device.getName(), 'Stored cloud snapshot for future use.');
                this.emit('new snapshot');
            }
            return Promise.resolve();
        }
        catch (err) {
            this.log.warn(this.device.getName(), 'Couldt not get cloud snapshot: ' + err);
            return Promise.reject(err);
        }
    }
    async handlePictureUrl(url) {
        this.log.debug(this.device.getName(), 'Got picture Url from eufy cloud: ' + url);
        if (!this.lastCloudSnapshot ||
            (this.lastCloudSnapshot && this.lastCloudSnapshot.sourceUrl && !this.urlsAreEqual(this.lastCloudSnapshot.sourceUrl, url))) {
            try {
                const timestamp = Date.now();
                const response = await this.downloadImageData(url);
                if (!(response.image.length < 20000 && this.refreshProcessRunning)) {
                    if (!this.lastCloudSnapshot ||
                        (this.lastCloudSnapshot && this.lastCloudSnapshot.timestamp < timestamp)) {
                        this.log.debug(this.device.getName(), 'stored new snapshot from cloud in memory.');
                        this.lastCloudSnapshot = {
                            timestamp: timestamp,
                            sourceUrl: response.url,
                            image: response.image,
                        };
                        if (!this.currentSnapshot ||
                            (this.currentSnapshot && this.currentSnapshot.timestamp < timestamp)) {
                            this.log.debug(this.device.getName(), 'cloud snapshot is most recent one. Storing this for future use.');
                            this.currentSnapshot = this.lastCloudSnapshot;
                        }
                        this.emit('new snapshot');
                    }
                }
                else {
                    this.log.debug(this.device.getName(), 'cloud snapshot had to low resolution. Waiting for snapshot from camera.');
                }
            }
            catch (err) {
                this.log.debug(this.device.getName(), 'image data could not be retireved: ' + err);
            }
        }
        else {
            this.log.debug(this.device.getName(), 'picture Url was already known. Ignore it.');
            this.lastCloudSnapshot.sourceUrl = url;
        }
    }
    downloadImageData(url, retries = 40) {
        return new Promise((resolve, reject) => {
            https_1.default.get(url, response => {
                if (response.headers.location) { // url forwarding; use new url
                    this.downloadImageData(response.headers.location, retries)
                        .then((imageResponse) => resolve(imageResponse))
                        .catch((err) => reject(err));
                }
                else { // get image buffer
                    let imageBuffer = Buffer.alloc(0);
                    response.on('data', (chunk) => {
                        imageBuffer = Buffer.concat([imageBuffer, chunk]);
                    });
                    response.on('end', () => {
                        if (!this.isXMLNotImage(imageBuffer) && response.statusCode && response.statusCode < 400) {
                            resolve({
                                url: url,
                                image: imageBuffer,
                            });
                        }
                        else if (retries <= 0) {
                            this.log.warn(this.device.getName(), 'Did not retrieve cloud snapshot in time. Reached max. retries.');
                            reject('Could not get image data');
                        }
                        else {
                            setTimeout(() => {
                                this.downloadImageData(url, retries - 1)
                                    .then((imageResponse) => resolve(imageResponse))
                                    .catch((err) => reject(err));
                            }, 500);
                        }
                    });
                    response.on('error', (err) => {
                        reject(err);
                    });
                }
            }).on('error', (err) => {
                reject(err);
            });
        });
    }
    isXMLNotImage(dataBuffer) {
        const possibleXML = dataBuffer.toString('utf8');
        return (possibleXML.indexOf('<?xml') !== -1 ||
            possibleXML.indexOf('<xml') !== -1 ||
            possibleXML.indexOf('<?html') !== -1 ||
            possibleXML.indexOf('<html') !== -1);
    }
    async fetchCurrentCameraSnapshot() {
        if (this.refreshProcessRunning) {
            return Promise.resolve();
        }
        this.refreshProcessRunning = true;
        this.log.debug(this.device.getName(), 'Locked refresh process.');
        this.log.debug(this.device.getName(), 'Fetching new snapshot from camera.');
        const timestamp = Date.now();
        try {
            const snapshotBuffer = await this.getCurrentCameraSnapshot();
            this.refreshProcessRunning = false;
            this.log.debug(this.device.getName(), 'Unlocked refresh process.');
            this.log.debug(this.device.getName(), 'store new snapshot from camera in memory. Using this for future use.');
            this.currentSnapshot = {
                timestamp: timestamp,
                image: snapshotBuffer,
            };
            this.emit('new snapshot');
            return Promise.resolve();
        }
        catch (err) {
            this.refreshProcessRunning = false;
            this.log.debug(this.device.getName(), 'Unlocked refresh process.');
            return Promise.reject(err);
        }
    }
    async getCurrentCameraSnapshot() {
        var _a;
        const source = await this.getCameraSource();
        if (!source) {
            return Promise.reject('No camera source detected.');
        }
        const parameters = await ffmpeg_1.FFmpegParameters.forSnapshot((_a = this.cameraConfig.videoConfig) === null || _a === void 0 ? void 0 : _a.debug);
        if (source.url) {
            parameters.setInputSource(source.url);
        }
        else if (source.stream && source.livestreamId) {
            await parameters.setInputStream(source.stream);
        }
        else {
            return Promise.reject('No valid camera source detected.');
        }
        if (this.cameraConfig.delayCameraSnapshot) {
            parameters.setDelayedSnapshot();
        }
        try {
            const ffmpeg = new ffmpeg_1.FFmpeg(`[${this.device.getName()}] [Snapshot Process]`, parameters, this.log);
            const buffer = await ffmpeg.getResult();
            if (source.livestreamId) {
                this.livestreamManager.stopProxyStream(source.livestreamId);
            }
            return Promise.resolve(buffer);
        }
        catch (err) {
            if (source.livestreamId) {
                this.livestreamManager.stopProxyStream(source.livestreamId);
            }
            return Promise.reject(err);
        }
    }
    async getCameraSource() {
        if ((0, utils_1.is_rtsp_ready)(this.device, this.cameraConfig, this.log)) {
            try {
                const url = this.device.getPropertyValue(eufy_security_client_1.PropertyName.DeviceRTSPStreamUrl);
                this.log.debug(this.device.getName(), 'RTSP URL: ' + url);
                return {
                    url: url,
                };
            }
            catch (err) {
                this.log.warn(this.device.getName(), 'Could not get snapshot from rtsp stream!');
                return null;
            }
        }
        else {
            try {
                const streamData = await this.livestreamManager.getLocalLivestream();
                return {
                    stream: streamData.videostream,
                    livestreamId: streamData.id,
                };
            }
            catch (err) {
                this.log.warn(this.device.getName(), 'Could not get snapshot from livestream!');
                return null;
            }
        }
    }
    urlsAreEqual(url1, url2) {
        return (this.getUrlWithoutParameters(url1) === this.getUrlWithoutParameters(url2));
    }
    getUrlWithoutParameters(url) {
        const endIndex = url.indexOf('.jpg');
        if (endIndex === -1) {
            return '';
        }
        return url.substring(0, endIndex);
    }
    async resizeSnapshot(snapshot, request) {
        var _a;
        const parameters = await ffmpeg_1.FFmpegParameters.forSnapshot((_a = this.cameraConfig.videoConfig) === null || _a === void 0 ? void 0 : _a.debug);
        parameters.setup(this.cameraConfig, request);
        const ffmpeg = new ffmpeg_1.FFmpeg(`[${this.device.getName()}] [Snapshot Resize Process]`, parameters, this.log);
        return ffmpeg.getResult(snapshot);
    }
}
exports.SnapshotManager = SnapshotManager;
//# sourceMappingURL=SnapshotManager.js.map