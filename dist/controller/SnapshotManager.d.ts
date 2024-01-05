/// <reference types="node" />
import { EventEmitter } from 'stream';
import { Camera } from 'eufy-security-client';
import { CameraConfig } from '../utils/configTypes';
import { EufySecurityPlatform } from '../platform';
import { LocalLivestreamManager } from './LocalLivestreamManager';
import { Logger } from '../utils/logger';
import { SnapshotRequest } from 'homebridge';
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
export declare class SnapshotManager extends EventEmitter {
    private readonly platform;
    private readonly device;
    private cameraConfig;
    private readonly videoProcessor;
    private log;
    private livestreamManager;
    private lastCloudSnapshot?;
    private currentSnapshot?;
    private blackSnapshot?;
    private refreshProcessRunning;
    private lastEvent;
    private lastRingEvent;
    private lastPictureUrlChanged;
    private snapshotRefreshTimer?;
    constructor(platform: EufySecurityPlatform, device: Camera, cameraConfig: CameraConfig, livestreamManager: LocalLivestreamManager, log: Logger);
    private onRingEvent;
    private onEvent;
    getSnapshotBuffer(request: SnapshotRequest): Promise<Buffer>;
    private getNewestSnapshotBuffer;
    private getBalancedSnapshot;
    private getNewestCloudSnapshot;
    private automaticSnapshotRefresh;
    private onPropertyValueChanged;
    private getSnapshotFromCloud;
    private handlePictureUrl;
    private downloadImageData;
    private isXMLNotImage;
    private fetchCurrentCameraSnapshot;
    private getCurrentCameraSnapshot;
    private getCameraSource;
    private urlsAreEqual;
    private getUrlWithoutParameters;
    private resizeSnapshot;
}
//# sourceMappingURL=SnapshotManager.d.ts.map