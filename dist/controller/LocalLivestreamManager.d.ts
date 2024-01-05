/// <reference types="node" />
import { EventEmitter, Readable } from 'stream';
import { Camera } from 'eufy-security-client';
import { EufySecurityPlatform } from '../platform';
import { Logger } from '../utils/logger';
declare class AudiostreamProxy extends Readable {
    private log;
    private cacheData;
    private pushNewDataImmediately;
    private dataFramesCount;
    constructor(log: Logger);
    private transmitData;
    newAudioData(data: Buffer): void;
    stopProxyStream(): void;
    _read(size: number): void;
}
declare class VideostreamProxy extends Readable {
    private manager;
    private livestreamId;
    private cacheData;
    private log;
    private killTimeout;
    private pushNewDataImmediately;
    private dataFramesCount;
    constructor(id: number, manager: LocalLivestreamManager, log: Logger);
    private transmitData;
    newVideoData(data: Buffer): void;
    stopProxyStream(): void;
    private resetKillTimeout;
    _read(size: number): void;
}
declare type ProxyStream = {
    id: number;
    videostream: VideostreamProxy;
    audiostream: AudiostreamProxy;
};
export declare class LocalLivestreamManager extends EventEmitter {
    private readonly SECONDS_UNTIL_TERMINATION_AFTER_LAST_USED;
    private readonly CONNECTION_ESTABLISHED_TIMEOUT;
    private stationStream;
    private log;
    private livestreamCount;
    private proxyStreams;
    private connectionTimeout?;
    private terminationTimeout?;
    private livestreamStartedAt;
    private livestreamIsStarting;
    private readonly platform;
    private readonly device;
    constructor(platform: EufySecurityPlatform, device: Camera, log: Logger);
    private initialize;
    getLocalLivestream(): Promise<ProxyStream>;
    private startAndGetLocalLiveStream;
    private scheduleLivestreamCacheTermination;
    stopLocalLiveStream(): void;
    private onStationLivestreamStop;
    private onStationLivestreamStart;
    private getProxyStream;
    stopProxyStream(id: number): void;
    private stopAllProxyStreams;
    private removeProxyStream;
}
export {};
//# sourceMappingURL=LocalLivestreamManager.d.ts.map