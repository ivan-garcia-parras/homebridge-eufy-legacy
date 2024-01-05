/// <reference types="node" />
import EventEmitter from 'events';
import { EufySecurity } from 'eufy-security-client';
import { PluginConfigInteractor } from './interfaces';
import { Logger } from './logger';
import bunyan from 'bunyan';
export declare class EufyClientInteractor extends EventEmitter implements PluginConfigInteractor {
    private client?;
    private storagePath;
    private log;
    private server?;
    constructor(path: string, log: Logger | bunyan, client?: EufySecurity);
    setClient(client: EufySecurity): void;
    setupServer(): Promise<void>;
    stopServer(): void;
    private getFreePort;
    private writePortToStoragePath;
    private loadPort;
    private ipcRequest;
    private processIPCRequest;
    private processDirectRequest;
    private getChargingStatus;
    private getExperimentalRTSPStatusChangeResult;
    private getExperimentalRTSPState;
    private getStationCamerasMap;
    private onSocketError;
    private onServerError;
    DeviceIsCharging(sn: string): Promise<number>;
    DeviceSetExperimentalRTSP(sn: string, value: boolean): Promise<string>;
    DeviceGetExperimentalRTSPStatus(sn: string): Promise<{
        state: boolean;
        url?: string;
    }>;
    GetStationCamerasMapping(): Promise<unknown>;
}
//# sourceMappingURL=EufyClientInteractor.d.ts.map