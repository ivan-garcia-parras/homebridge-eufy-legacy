/// <reference types="node" />
import { API, CameraController, CameraStreamingDelegate, HAP, PrepareStreamCallback, PrepareStreamRequest, SnapshotRequest, SnapshotRequestCallback, SRTPCryptoSuites, StreamingRequest, StreamRequestCallback } from 'homebridge';
import { Socket } from 'dgram';
import { CameraConfig } from '../utils/configTypes';
import { FFmpeg } from '../utils/ffmpeg';
import { Camera } from 'eufy-security-client';
import { EufySecurityPlatform } from '../platform';
import { LocalLivestreamManager } from './LocalLivestreamManager';
import { TalkbackStream } from '../utils/Talkback';
export declare type SessionInfo = {
    address: string;
    ipv6: boolean;
    videoPort: number;
    videoReturnPort: number;
    videoCryptoSuite: SRTPCryptoSuites;
    videoSRTP: Buffer;
    videoSSRC: number;
    audioPort: number;
    audioReturnPort: number;
    audioCryptoSuite: SRTPCryptoSuites;
    audioSRTP: Buffer;
    audioSSRC: number;
};
declare type ActiveSession = {
    videoProcess?: FFmpeg;
    audioProcess?: FFmpeg;
    returnProcess?: FFmpeg;
    timeout?: NodeJS.Timeout;
    socket?: Socket;
    cachedStreamId?: number;
    talkbackStream?: TalkbackStream;
};
export declare class StreamingDelegate implements CameraStreamingDelegate {
    private readonly hap;
    private readonly api;
    private readonly log;
    private readonly cameraName;
    private cameraConfig;
    private videoConfig;
    private controller?;
    private readonly platform;
    private readonly device;
    private localLivestreamManager;
    private snapshotManager;
    pendingSessions: Map<string, SessionInfo>;
    ongoingSessions: Map<string, ActiveSession>;
    timeouts: Map<string, NodeJS.Timeout>;
    constructor(platform: EufySecurityPlatform, device: Camera, cameraConfig: CameraConfig, api: API, hap: HAP);
    setController(controller: CameraController): void;
    getLivestreamManager(): LocalLivestreamManager;
    handleSnapshotRequest(request: SnapshotRequest, callback: SnapshotRequestCallback): Promise<void>;
    prepareStream(request: PrepareStreamRequest, callback: PrepareStreamCallback): Promise<void>;
    private startStream;
    handleStreamRequest(request: StreamingRequest, callback: StreamRequestCallback): void;
    stopStream(sessionId: string): void;
}
export {};
//# sourceMappingURL=streamingDelegate.d.ts.map