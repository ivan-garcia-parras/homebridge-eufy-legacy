/// <reference types="node" />
import { Duplex } from 'stream';
import { EufySecurityPlatform } from '../platform';
import { Device } from 'eufy-security-client';
export declare class TalkbackStream extends Duplex {
    private platform;
    private camera;
    private cacheData;
    private talkbackStarted;
    private stopTalkbackTimeout?;
    private targetStream?;
    private talkbackStartedHandle;
    private talkbackStoppedHandle;
    constructor(platform: EufySecurityPlatform, camera: Device);
    private onTalkbackStarted;
    private onTalkbackStopped;
    stopTalkbackStream(): void;
    _read(size: number): void;
    _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void;
    private startTalkback;
    private stopTalkback;
}
//# sourceMappingURL=Talkback.d.ts.map