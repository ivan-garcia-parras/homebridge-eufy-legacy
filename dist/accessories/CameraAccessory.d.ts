import { Service, PlatformAccessory, CharacteristicValue, CameraControllerOptions } from 'homebridge';
import { EufySecurityPlatform } from '../platform';
import { DeviceAccessory } from './Device';
import { Camera } from 'eufy-security-client';
import { StreamingDelegate } from '../controller/streamingDelegate';
import { CameraConfig } from '../utils/configTypes';
import { RecordingDelegate } from '../controller/recordingDelegate';
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class CameraAccessory extends DeviceAccessory {
    protected service: Service;
    protected CameraService: Service;
    readonly cameraConfig: CameraConfig;
    protected streamingDelegate: StreamingDelegate | null;
    protected recordingDelegate?: RecordingDelegate;
    protected cameraControllerOptions?: CameraControllerOptions;
    constructor(platform: EufySecurityPlatform, accessory: PlatformAccessory, eufyDevice: Camera, isDoorbell?: boolean);
    /**
     * Handle the setting of ExperimentalMode since it can not be achieve through the constructor since getStationById is async.
     */
    setExperimentalMode(): Promise<void>;
    private getCameraConfig;
    protected cameraSetup(accessory: PlatformAccessory): void;
    handleEventSnapshotsActiveGet(): Promise<CharacteristicValue>;
    /**
     * Handle requests to set the "Event Snapshots Active" characteristic
     */
    handleEventSnapshotsActiveSet(value: any): void;
    handlePeriodicSnapshotsActiveGet(): Promise<CharacteristicValue>;
    /**
     * Handle requests to set the "Periodic Snapshots Active" characteristic
     */
    handlePeriodicSnapshotsActiveSet(value: any): void;
    /**
     * Handle requests to get the current value of the "HomeKit Camera Active" characteristic
     */
    handleHomeKitCameraActiveGet(): Promise<CharacteristicValue>;
    /**
     * Handle requests to set the "HomeKit Camera Active" characteristic
     */
    handleHomeKitCameraActiveSet(value: any): void;
    /**
     * Handle requests to get the current value of the "HomeKit Camera Active" characteristic
     */
    handleHomeKitCameraOperatingModeIndicatorGet(): Promise<CharacteristicValue>;
    /**
     * Handle requests to set the "HomeKit Camera Active" characteristic
     */
    handleHomeKitCameraOperatingModeIndicatorSet(value: any): Promise<void>;
    /**
     * Handle requests to get the current value of the "HomeKit Camera Active" characteristic
     */
    handleHomeKitNightVisionGet(): Promise<CharacteristicValue>;
    /**
     * Handle requests to set the "HomeKit Camera Active" characteristic
     */
    handleHomeKitNightVisionSet(value: any): Promise<void>;
    private motionFunction;
    handleMotionDetectedGet(): Promise<CharacteristicValue>;
    private onPropertyChange;
    handleEnableGet(): Promise<CharacteristicValue>;
    handleManuallyDisabledGet(): Promise<CharacteristicValue>;
    handleEnableSet(value: CharacteristicValue): Promise<void>;
    handleMotionOnGet(): Promise<CharacteristicValue>;
    handleMotionOnSet(value: CharacteristicValue): Promise<void>;
    handleLightOnGet(): Promise<CharacteristicValue>;
    handleLightOnSet(value: CharacteristicValue): Promise<void>;
}
//# sourceMappingURL=CameraAccessory.d.ts.map