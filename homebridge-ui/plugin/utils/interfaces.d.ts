export declare class EufyClientNotRunningError extends Error {
    constructor(message?: string);
}
export interface PluginConfigInteractor {
    DeviceIsCharging(sn: string): Promise<number>;
    DeviceSetExperimentalRTSP(sn: string, value: boolean): Promise<string>;
    DeviceGetExperimentalRTSPStatus(sn: string): Promise<{
        state: boolean;
        url?: string;
    }>;
    GetStationCamerasMapping(): Promise<unknown>;
}
//# sourceMappingURL=interfaces.d.ts.map