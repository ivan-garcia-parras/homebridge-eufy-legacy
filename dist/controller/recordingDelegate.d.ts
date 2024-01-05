import { Camera } from 'eufy-security-client';
import { CameraController, CameraRecordingConfiguration, CameraRecordingDelegate, HDSProtocolSpecificErrorReason, PlatformAccessory, RecordingPacket } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { CameraConfig } from '../utils/configTypes';
import { Logger } from '../utils/logger';
import { LocalLivestreamManager } from './LocalLivestreamManager';
export declare class RecordingDelegate implements CameraRecordingDelegate {
    private platform;
    private log;
    private camera;
    private cameraConfig;
    private accessory;
    private configuration?;
    private forceStopTimeout?;
    private closeReason?;
    private handlingStreamingRequest;
    private localLivestreamManager;
    private controller?;
    private session?;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, device: Camera, cameraConfig: CameraConfig, livestreamManager: LocalLivestreamManager, log: Logger);
    setController(controller: CameraController): void;
    isRecording(): boolean;
    handleRecordingStreamRequest(streamId: number): AsyncGenerator<RecordingPacket, any, unknown>;
    updateRecordingActive(active: boolean): void;
    updateRecordingConfiguration(configuration: CameraRecordingConfiguration | undefined): void;
    closeRecordingStream(streamId: number, reason: HDSProtocolSpecificErrorReason | undefined): void;
    acknowledgeStream(streamId: any): void;
}
//# sourceMappingURL=recordingDelegate.d.ts.map