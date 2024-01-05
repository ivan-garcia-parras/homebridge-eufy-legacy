"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpeg = exports.FFmpegParameters = void 0;
const child_process_1 = require("child_process");
const net_1 = __importDefault(require("net"));
const os_1 = __importDefault(require("os"));
const ffmpeg_for_homebridge_1 = __importDefault(require("ffmpeg-for-homebridge"));
const pick_port_1 = __importDefault(require("pick-port"));
const events_1 = __importDefault(require("events"));
class FFmpegProgress extends events_1.default {
    constructor(port) {
        super();
        this.started = false;
        this.port = port;
        let killTimeout = undefined;
        this.server = net_1.default.createServer((socket) => {
            if (killTimeout) {
                clearTimeout(killTimeout);
            }
            this.server.close(); // close server and terminate after connection is released
            socket.on('data', this.analyzeProgress.bind(this));
            socket.on('error', (err) => {
                // ignore since this is handled elsewhere
            });
        });
        killTimeout = setTimeout(() => {
            this.server.close();
        }, 30 * 1000);
        this.server.on('close', () => {
            this.emit('progress stopped');
        });
        this.server.on('error', (err) => {
            // ignore since this is handled elsewhere
        });
        this.server.listen(this.port);
    }
    analyzeProgress(progressData) {
        const progress = new Map();
        progressData.toString().split(/\r?\n/).forEach((line) => {
            const split = line.split('=', 2);
            if (split.length !== 2) {
                return;
            }
            progress.set(split[0], split[1]);
        });
        if (!this.started) {
            if (progress.get('progress') !== undefined) {
                this.started = true;
                this.emit('progress started');
            }
        }
    }
}
class FFmpegParameters {
    constructor(port, isVideo, isAudio, isSnapshot, debug = false) {
        this.hideBanner = true;
        this.useWallclockAsTimestamp = true;
        this.inputSoure = '-i pipe:';
        this.output = 'pipe:1';
        this.codec = 'copy';
        this.crop = false;
        this.flagsGlobalHeader = false;
        this.delaySnapshot = false;
        this.processAudio = true;
        this.progressPort = port;
        this.isVideo = isVideo;
        this.isAudio = isAudio;
        this.isSnapshot = isSnapshot;
        this.debug = debug;
    }
    static async forAudio(debug = false) {
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        const ffmpeg = new FFmpegParameters(port, false, true, false, debug);
        ffmpeg.useWallclockAsTimestamp = false;
        ffmpeg.flagsGlobalHeader = true;
        return ffmpeg;
    }
    static async forVideo(debug = false) {
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        return new FFmpegParameters(port, true, false, false, debug);
    }
    static async forSnapshot(debug = false) {
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        const ffmpeg = new FFmpegParameters(port, false, false, true, debug);
        ffmpeg.useWallclockAsTimestamp = false;
        ffmpeg.numberFrames = 1;
        ffmpeg.format = 'image2';
        return ffmpeg;
    }
    static async forVideoRecording(debug = false) {
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        const ffmpeg = new FFmpegParameters(port, true, false, false, debug);
        ffmpeg.useWallclockAsTimestamp = true;
        return ffmpeg;
    }
    static async forAudioRecording(debug = false) {
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        const ffmpeg = new FFmpegParameters(port, false, true, false, debug);
        return ffmpeg;
    }
    setResolution(width, height) {
        this.width = width;
        this.height = height;
    }
    usesStdInAsInput() {
        return this.inputSoure === '-i pipe:';
    }
    setInputSource(value) {
        this.inputSoure = `-i ${value}`;
    }
    async setInputStream(input) {
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        let killTimeout = undefined;
        const server = net_1.default.createServer((socket) => {
            if (killTimeout) {
                clearTimeout(killTimeout);
            }
            server.close();
            socket.on('error', (_) => {
                // ignore since this is handled elsewhere
            });
            input.pipe(socket);
        });
        server.listen(port);
        server.on('error', (_) => {
            // ignore since this is handled elsewhere
        });
        killTimeout = setTimeout(() => {
            server.close();
        }, 30 * 1000);
        this.setInputSource(`tcp://127.0.0.1:${port}`);
    }
    setDelayedSnapshot() {
        this.delaySnapshot = true;
    }
    setup(cameraConfig, request) {
        var _a;
        const videoConfig = (_a = cameraConfig.videoConfig) !== null && _a !== void 0 ? _a : (cameraConfig.videoConfig = {});
        if (videoConfig.videoProcessor && videoConfig.videoProcessor !== '') {
            this.processor = videoConfig.videoProcessor;
        }
        if (videoConfig.readRate) {
            this.readrate = videoConfig.readRate;
        }
        if (videoConfig.stimeout) {
            this.stimeout = videoConfig.stimeout;
        }
        if (videoConfig.probeSize) {
            this.probeSize = videoConfig.probeSize;
        }
        if (videoConfig.analyzeDuration) {
            this.analyzeDuration = videoConfig.analyzeDuration;
        }
        if (this.isVideo) {
            const req = request;
            let codec = 'libx264';
            if (videoConfig.vcodec && videoConfig.vcodec !== '') {
                codec = videoConfig.vcodec;
            }
            this.codec = codec;
            if (codec !== 'copy') {
                const fps = videoConfig.maxFPS ? videoConfig.maxFPS : req.video.fps;
                this.fps = fps;
                const bitrate = videoConfig.maxBitrate ? videoConfig.maxBitrate : req.video.max_bit_rate;
                this.bitrate = bitrate;
                this.bufsize = bitrate * 2;
                this.maxrate = bitrate;
                let encoderOptions = codec === 'libx264' ? '-preset ultrafast -tune zerolatency' : '';
                if (videoConfig.encoderOptions) {
                    encoderOptions = videoConfig.encoderOptions;
                }
                this.codecOptions = encoderOptions;
                this.pixFormat = 'yuv420p';
                this.colorRange = 'mpeg';
                let width = req.video.width;
                if (videoConfig.maxWidth && videoConfig.maxWidth < width) {
                    width = videoConfig.maxWidth;
                }
                let height = req.video.height;
                if (videoConfig.maxHeight && videoConfig.maxHeight < height) {
                    height = videoConfig.maxHeight;
                }
                this.width = width;
                this.height = height;
                if (videoConfig.videoFilter && videoConfig.videoFilter !== '') {
                    this.filters = videoConfig.videoFilter;
                }
                if (videoConfig.crop) {
                    this.crop = videoConfig.crop;
                }
            }
        }
        if (this.isAudio) {
            const req = request;
            let codec = 'libfdk_aac';
            let codecOptions = '-profile:a aac_eld';
            switch (req.audio.codec) {
                case "OPUS" /* OPUS */:
                    codec = 'libopus';
                    codecOptions = '-application lowdelay';
                    break;
                default:
                    codec = 'libfdk_aac';
                    codecOptions = '-profile:a aac_eld';
                    break;
            }
            if (videoConfig.acodec && videoConfig.acodec !== '') {
                codec = videoConfig.acodec;
                codecOptions = '';
            }
            if (videoConfig.acodecOptions !== undefined) {
                codecOptions = videoConfig.acodecOptions;
            }
            if (this.flagsGlobalHeader) {
                if (codecOptions !== '') {
                    codecOptions += ' ';
                }
                codecOptions += '-flags +global_header';
            }
            this.codec = codec;
            this.codecOptions = codecOptions;
            if (this.codec !== ' copy') {
                this.sampleRate = req.audio.sample_rate;
                this.channels = req.audio.channel;
                this.bitrate = videoConfig.audioBitrate ? videoConfig.audioBitrate : req.audio.max_bit_rate;
            }
        }
        if (this.isSnapshot) {
            const req = request;
            let width = req.width;
            if (videoConfig.maxWidth && videoConfig.maxWidth < width) {
                width = videoConfig.maxWidth;
            }
            let height = req.height;
            if (videoConfig.maxHeight && videoConfig.maxHeight < height) {
                height = videoConfig.maxHeight;
            }
            this.width = width;
            this.height = height;
            if (videoConfig.videoFilter && videoConfig.videoFilter !== '') {
                this.filters = videoConfig.videoFilter;
            }
            if (videoConfig.crop) {
                this.crop = videoConfig.crop;
            }
        }
    }
    setRTPTarget(sessionInfo, request) {
        if (this.isVideo) {
            this.payloadType = request.video.pt;
            this.ssrc = sessionInfo.videoSSRC;
            this.srtpParams = sessionInfo.videoSRTP.toString('base64');
            this.srtpSuite = 'AES_CM_128_HMAC_SHA1_80';
            this.format = 'rtp';
            this.output = `srtp://${sessionInfo.address}:${sessionInfo.videoPort}?rtcpport=${sessionInfo.videoPort}&pkt_size=1128`;
        }
        if (this.isAudio) {
            this.payloadType = request.audio.pt;
            this.ssrc = sessionInfo.audioSSRC;
            this.srtpParams = sessionInfo.audioSRTP.toString('base64');
            this.srtpSuite = 'AES_CM_128_HMAC_SHA1_80';
            this.format = 'rtp';
            this.output = `srtp://${sessionInfo.address}:${sessionInfo.audioPort}?rtcpport=${sessionInfo.audioPort}&pkt_size=188`;
        }
    }
    setOutput(output) {
        this.output = output;
    }
    setupForRecording(videoConfig, configuration) {
        var _a, _b;
        this.movflags = 'frag_keyframe+empty_moov+default_base_moof';
        this.maxMuxingQueueSize = 1024;
        if (videoConfig.videoProcessor && videoConfig.videoProcessor !== '') {
            this.processor = videoConfig.videoProcessor;
        }
        if (this.isVideo) {
            if (videoConfig.vcodec && videoConfig.vcodec !== '') {
                this.codec = videoConfig.vcodec;
            }
            else {
                this.codec = 'libx264';
            }
            if (this.codec === 'libx264') {
                this.pixFormat = 'yuv420p';
                const profile = configuration.videoCodec.parameters.profile === 2 /* HIGH */
                    ? 'high'
                    : configuration.videoCodec.parameters.profile === 1 /* MAIN */
                        ? 'main'
                        : 'baseline';
                const level = configuration.videoCodec.parameters.level === 2 /* LEVEL4_0 */
                    ? '4.0'
                    : configuration.videoCodec.parameters.level === 1 /* LEVEL3_2 */
                        ? '3.2'
                        : '3.1';
                this.codecOptions = `-profile:v ${profile} -level:v ${level}`;
            }
            if (this.codec !== 'copy') {
                this.bitrate = (_a = videoConfig.maxBitrate) !== null && _a !== void 0 ? _a : configuration.videoCodec.parameters.bitRate;
                this.width = configuration.videoCodec.resolution[0];
                this.height = configuration.videoCodec.resolution[1];
                this.fps = (_b = videoConfig.maxFPS) !== null && _b !== void 0 ? _b : configuration.videoCodec.resolution[2];
                this.crop = (videoConfig.crop !== false); // only false if 'crop: false' was specifically set
            }
            this.iFrameInterval = configuration.videoCodec.parameters.iFrameInterval;
        }
        if (this.isAudio) {
            if (videoConfig.audio === false) {
                this.processAudio = false;
            }
            if (videoConfig.acodec && videoConfig.acodec !== '') {
                this.codec = videoConfig.acodec;
            }
            else {
                this.codec = 'libfdk_aac';
            }
            if (this.codec === 'libfdk_aac' || this.codec === 'aac') {
                this.codecOptions = (configuration.audioCodec.type === 0 /* AAC_LC */)
                    ? '-profile:a aac_low'
                    : '-profile:a aac_eld';
                this.codecOptions += ' -flags +global_header';
            }
            if (this.codec !== 'copy') {
                let samplerate;
                switch (configuration.audioCodec.samplerate) {
                    case 0 /* KHZ_8 */:
                        samplerate = '8';
                        break;
                    case 1 /* KHZ_16 */:
                        samplerate = '16';
                        break;
                    case 2 /* KHZ_24 */:
                        samplerate = '24';
                        break;
                    case 3 /* KHZ_32 */:
                        samplerate = '32';
                        break;
                    case 4 /* KHZ_44_1 */:
                        samplerate = '44.1';
                        break;
                    case 5 /* KHZ_48 */:
                        samplerate = '48';
                        break;
                    default:
                        throw new Error(`Unsupported audio samplerate: ${configuration.audioCodec.samplerate}`);
                }
                this.sampleRate = samplerate;
                this.bitrate = configuration.audioCodec.bitrate;
                this.channels = configuration.audioCodec.audioChannels;
            }
        }
    }
    async setTalkbackInput(sessionInfo) {
        this.useWallclockAsTimestamp = false;
        this.protocolWhitelist = 'pipe,udp,rtp,file,crypto,tcp';
        this.inputFormat = 'sdp';
        this.inputCodec = 'libfdk_aac';
        this.codec = 'libfdk_aac';
        this.sampleRate = 16;
        this.channels = 1;
        this.bitrate = 20;
        this.format = 'adts';
        const ipVer = sessionInfo.ipv6 ? 'IP6' : 'IP4';
        const sdpInput = 'v=0\r\n' +
            'o=- 0 0 IN ' + ipVer + ' ' + sessionInfo.address + '\r\n' +
            's=Talk\r\n' +
            'c=IN ' + ipVer + ' ' + sessionInfo.address + '\r\n' +
            't=0 0\r\n' +
            'm=audio ' + sessionInfo.audioReturnPort + ' RTP/AVP 110\r\n' +
            'b=AS:24\r\n' +
            'a=rtpmap:110 MPEG4-GENERIC/16000/1\r\n' +
            'a=rtcp-mux\r\n' + // FFmpeg ignores this, but might as well
            'a=fmtp:110 ' +
            'profile-level-id=1;mode=AAC-hbr;sizelength=13;indexlength=3;indexdeltalength=3; ' +
            'config=F8F0212C00BC00\r\n' +
            'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:' + sessionInfo.audioSRTP.toString('base64') + '\r\n';
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        let killTimeout = undefined;
        const server = net_1.default.createServer((socket) => {
            if (killTimeout) {
                clearTimeout(killTimeout);
            }
            server.close();
            socket.on('error', (_) => {
                // ignore since this is handled elsewhere
            });
            socket.end(sdpInput);
        });
        server.listen(port);
        server.on('error', (_) => {
            // ignore since this is handled elsewhere
        });
        killTimeout = setTimeout(() => {
            server.close();
        }, 30 * 1000);
        this.setInputSource(`tcp://127.0.0.1:${port}`);
    }
    setTalkbackChannels(channels) {
        this.channels = channels;
    }
    buildGenericParameters() {
        const params = [];
        params.push(this.hideBanner ? '-hide_banner' : '');
        params.push('-loglevel level+verbose'); // default log to stderr
        params.push(this.useWallclockAsTimestamp ? '-use_wallclock_as_timestamps 1' : '');
        return params;
    }
    buildInputParamters() {
        const params = [];
        // input
        params.push(this.analyzeDuration ? `-analyzeduration ${this.analyzeDuration}` : '');
        params.push(this.probeSize ? `-probesize ${this.probeSize}` : '');
        params.push(this.stimeout ? `-stimeout ${this.stimeout * 10000000}` : '');
        params.push(this.readrate ? '-re' : '');
        params.push(this.protocolWhitelist ? `-protocol_whitelist ${this.protocolWhitelist}` : '');
        params.push(this.inputFormat ? `-f ${this.inputFormat}` : '');
        params.push(this.inputCodec ? `-c:a ${this.inputCodec}` : '');
        params.push(this.inputSoure);
        params.push(this.isVideo ? '-an -sn -dn' : '');
        params.push(this.isAudio ? '-vn -sn -dn' : '');
        return params;
    }
    buildEncodingParameters() {
        const params = [];
        if (this.isVideo) {
            params.push(this.fps ? '-r ' + this.fps : '');
            params.push('-vcodec ' + this.codec);
            params.push(this.pixFormat ? '-pix_fmt ' + this.pixFormat : '');
            params.push(this.colorRange ? '-color_range ' + this.colorRange : '');
            params.push(this.codecOptions ? this.codecOptions : '');
            // video filters
            const filters = this.filters ? this.filters.split(',') : [];
            const noneFilter = filters.indexOf('none');
            if (noneFilter >= 0) {
                filters.splice(noneFilter, 1);
            }
            if (noneFilter < 0 && this.width && this.height) {
                if (this.crop) {
                    const resizeFilter = `scale=${this.width}:${this.height}:force_original_aspect_ratio=increase`;
                    filters.push(resizeFilter);
                    filters.push(`crop=${this.width}:${this.height}`);
                    filters.push(`scale='trunc(${this.width}/2)*2:trunc(${this.height}/2)*2'`); // Force to fit encoder restrictions
                }
                else {
                    const resizeFilter = 'scale=' +
                        '\'min(' + this.width + ',iw)\'' +
                        ':' +
                        '\'min(' + this.height + ',ih)\'' +
                        ':force_original_aspect_ratio=decrease';
                    filters.push(resizeFilter);
                    filters.push('scale=\'trunc(iw/2)*2:trunc(ih/2)*2\''); // Force to fit encoder restrictions
                }
            }
            if (filters.length > 0) {
                params.push('-filter:v ' + filters.join(','));
            }
            params.push(this.bitrate ? '-b:v ' + this.bitrate + 'k' : '');
            params.push(this.bufsize ? '-bufsize ' + this.bufsize + 'k' : '');
            params.push(this.maxrate ? `-maxrate ${this.maxrate}k` : '');
        }
        if (this.isAudio && this.processAudio) {
            // audio parameters
            params.push('-acodec ' + this.codec);
            params.push(this.codecOptions ? this.codecOptions : '');
            params.push(this.bitrate ? `-b:a ${this.bitrate}k` : '');
            params.push(this.sampleRate ? `-ar ${this.sampleRate}k` : '');
            params.push(this.bitrate ? `-ac ${this.channels}` : '');
        }
        if (this.isSnapshot) {
            params.push(this.numberFrames ? `-frames:v ${this.numberFrames}` : '');
            params.push(this.delaySnapshot ? '-ss 00:00:00.500' : '');
            const filters = this.filters ? this.filters.split(',') : [];
            const noneFilter = filters.indexOf('none');
            if (noneFilter >= 0) {
                filters.splice(noneFilter, 1);
            }
            if (noneFilter < 0 && this.width && this.height) {
                if (this.crop) {
                    const resizeFilter = `scale=${this.width}:${this.height}:force_original_aspect_ratio=increase`;
                    filters.push(resizeFilter);
                    filters.push(`crop=${this.width}:${this.height}`);
                    filters.push(`scale='trunc(${this.width}/2)*2:trunc(${this.height}/2)*2'`); // Force to fit encoder restrictions
                }
                else {
                    const resizeFilter = 'scale=' +
                        '\'min(' + this.width + ',iw)\'' +
                        ':' +
                        '\'min(' + this.height + ',ih)\'' +
                        ':force_original_aspect_ratio=decrease';
                    filters.push(resizeFilter);
                    filters.push('scale=\'trunc(iw/2)*2:trunc(ih/2)*2\''); // Force to fit encoder restrictions
                }
            }
            if (filters.length > 0) {
                params.push('-filter:v ' + filters.join(','));
            }
        }
        return params;
    }
    buildOutputParameters() {
        const params = [];
        // output
        params.push(this.payloadType ? `-payload_type ${this.payloadType}` : '');
        params.push(this.ssrc ? `-ssrc ${this.ssrc}` : '');
        params.push(this.format ? `-f ${this.format}` : '');
        params.push(this.srtpSuite ? `-srtp_out_suite ${this.srtpSuite}` : '');
        params.push(this.srtpParams ? `-srtp_out_params ${this.srtpParams}` : '');
        params.push(this.output);
        return params;
    }
    buildParameters() {
        let params = [];
        params = this.buildGenericParameters();
        params = params.concat(this.buildInputParamters());
        params = params.concat(this.buildEncodingParameters());
        params = params.concat(this.buildOutputParameters());
        params.push(`-progress tcp://127.0.0.1:${this.progressPort}`);
        params = params.filter(x => x !== '');
        return params;
    }
    getProcessArguments() {
        return this.buildParameters();
    }
    static getRecordingArguments(parameters) {
        let params = [];
        if (parameters.length === 0) {
            return params;
        }
        params = parameters[0].buildGenericParameters();
        // input
        params.push(parameters[0].inputSoure);
        if (parameters.length > 1 && parameters[0].inputSoure !== parameters[1].inputSoure) { // don't include extra audio source for rtsp
            if (parameters[1].processAudio) {
                params.push(parameters[1].inputSoure);
            }
            else {
                params.push('-f lavfi -i anullsrc -shortest');
            }
        }
        if (parameters.length === 1) {
            params.push('-an');
        }
        params.push('-sn -dn');
        // video encoding
        params = params.concat(parameters[0].buildEncodingParameters());
        params.push(parameters[0].iFrameInterval ? `-force_key_frames expr:gte(t,n_forced*${parameters[0].iFrameInterval / 1000})` : '');
        // audio encoding
        if (parameters.length > 1) {
            if (parameters[1].processAudio) {
                params.push('-bsf:a aac_adtstoasc');
            }
            params = params.concat(parameters[1].buildEncodingParameters());
        }
        // fragmented mp4 options
        params.push(parameters[0].movflags ? `-movflags ${parameters[0].movflags}` : '');
        params.push(parameters[0].maxMuxingQueueSize ? `-max_muxing_queue_size ${parameters[0].maxMuxingQueueSize}` : '');
        // output
        params.push('-f mp4');
        params.push(parameters[0].output);
        params.push(`-progress tcp://127.0.0.1:${parameters[0].progressPort}`);
        params = params.filter(x => x !== '');
        return params;
    }
    static getCombinedArguments(parameters) {
        let params = [];
        if (parameters.length === 0) {
            return params;
        }
        params = parameters[0].buildGenericParameters();
        parameters.forEach((p) => {
            params = params.concat(p.buildInputParamters());
            params = params.concat(p.buildEncodingParameters());
            params = params.concat(p.buildOutputParameters());
        });
        params.push(`-progress tcp://127.0.0.1:${parameters[0].progressPort}`);
        params = params.filter(x => x !== '');
        return params;
    }
    getStreamStartText() {
        let message = '';
        if (this.isVideo) {
            message = this.codec === 'copy' ? 'native' : `${this.width}x${this.height}, ${this.fps} fps, ${this.bitrate} kbps`;
            return `Starting video stream: ${message}`;
        }
        if (this.isAudio) {
            message = this.codec === 'copy' ? 'native' : `${this.sampleRate} kHz, ${this.bitrate} kbps, codec: ${this.codec}`;
            return `Starting audio stream: ${message}`;
        }
        return 'Starting unknown stream';
    }
    hasCustomFfmpeg() {
        return (this.processor !== undefined);
    }
    getCustomFfmpeg() {
        return (this.hasCustomFfmpeg()) ? this.processor : '';
    }
}
exports.FFmpegParameters = FFmpegParameters;
class FFmpeg extends events_1.default {
    constructor(name, parameters, log) {
        super();
        this.ffmpegExec = ffmpeg_for_homebridge_1.default || 'ffmpeg';
        this.name = name;
        this.log = log;
        if (Array.isArray(parameters)) {
            if (parameters.length === 0) {
                throw new Error('No ffmpeg parameters found.');
            }
            this.parameters = parameters;
        }
        else {
            this.parameters = [parameters];
        }
        if (this.parameters[0].hasCustomFfmpeg()) {
            this.ffmpegExec = this.parameters[0].getCustomFfmpeg();
        }
    }
    start() {
        this.starttime = Date.now();
        this.progress = new FFmpegProgress(this.parameters[0].progressPort);
        this.progress.on('progress started', this.onProgressStarted.bind(this));
        const processArgs = FFmpegParameters.getCombinedArguments(this.parameters);
        this.log.debug(this.name, 'Stream command: ' + this.ffmpegExec + ' ' + processArgs.join(' '));
        this.parameters.forEach((p) => {
            this.log.info(this.name, p.getStreamStartText());
        });
        this.process = (0, child_process_1.spawn)(this.ffmpegExec, processArgs.join(' ').split(/\s+/), { env: process.env });
        this.stdin = this.process.stdin;
        this.stdout = this.process.stdout;
        this.process.stderr.on('data', (chunk) => {
            const isError = chunk.toString().indexOf('[panic]') !== -1 ||
                chunk.toString().indexOf('[error]') !== -1 ||
                chunk.toString().indexOf('[fatal]') !== -1;
            if (this.parameters[0].debug && !isError) {
                this.log.debug(this.name, 'ffmpeg log message:\n' + chunk.toString());
            }
            else if (isError) {
                this.log.error(this.name, 'ffmpeg log message:\n' + chunk.toString());
            }
        });
        this.process.on('error', this.onProcessError.bind(this));
        this.process.on('exit', this.onProcessExit.bind(this));
    }
    async getResult(input) {
        this.starttime = Date.now();
        this.progress = new FFmpegProgress(this.parameters[0].progressPort);
        this.progress.on('progress started', this.onProgressStarted.bind(this));
        const processArgs = FFmpegParameters.getCombinedArguments(this.parameters);
        this.log.debug(this.name, 'Process command: ' + this.ffmpegExec + ' ' + processArgs.join(' '));
        return new Promise((resolve, reject) => {
            this.process = (0, child_process_1.spawn)(this.ffmpegExec, processArgs.join(' ').split(/\s+/), { env: process.env });
            this.process.stderr.on('data', (chunk) => {
                const isError = chunk.toString().indexOf('[panic]') !== -1 ||
                    chunk.toString().indexOf('[error]') !== -1 ||
                    chunk.toString().indexOf('[fatal]') !== -1;
                if (this.parameters[0].debug && !isError) {
                    this.log.debug(this.name, 'ffmpeg log message:\n' + chunk.toString());
                }
                else if (isError) {
                    this.log.error(this.name, 'ffmpeg log message:\n' + chunk.toString());
                }
            });
            const killTimeout = setTimeout(() => {
                this.stop();
                reject('ffmpeg process timed out.');
            }, 15 * 1000);
            this.process.on('error', (err) => {
                reject(err);
                this.onProcessError(err);
            });
            let resultBuffer = Buffer.alloc(0);
            this.process.stdout.on('data', (data) => {
                resultBuffer = Buffer.concat([resultBuffer, data]);
            });
            this.process.on('exit', () => {
                if (killTimeout) {
                    clearTimeout(killTimeout);
                }
                if (resultBuffer.length > 0) {
                    resolve(resultBuffer);
                }
                else {
                    reject('Failed to fetch data.');
                }
            });
            if (input) {
                this.process.stdin.end(input);
            }
        });
    }
    async startFragmentedMP4Session() {
        this.starttime = Date.now();
        this.progress = new FFmpegProgress(this.parameters[0].progressPort);
        this.progress.on('progress started', this.onProgressStarted.bind(this));
        const port = await (0, pick_port_1.default)({
            type: 'tcp',
            ip: '0.0.0.0',
            reserveTimeout: 15,
        });
        return new Promise((resolve, reject) => {
            const server = net_1.default.createServer((socket) => {
                server.close();
                resolve({
                    socket: socket,
                    process: this.process,
                    generator: this.parseFragmentedMP4(socket),
                });
            });
            server.listen(port, () => {
                this.parameters[0].setOutput(`tcp://127.0.0.1:${port}`);
                const processArgs = FFmpegParameters.getRecordingArguments(this.parameters);
                this.log.debug(this.name, 'Stream command: ' + this.ffmpegExec + ' ' + processArgs.join(' '));
                this.parameters.forEach((p) => {
                    this.log.info(this.name, p.getStreamStartText());
                });
                this.process = (0, child_process_1.spawn)(this.ffmpegExec, processArgs.join(' ').split(/\s+/), { env: process.env });
                this.stdin = this.process.stdin;
                this.stdout = this.process.stdout;
                this.process.stderr.on('data', (chunk) => {
                    const isError = chunk.toString().indexOf('[panic]') !== -1 ||
                        chunk.toString().indexOf('[error]') !== -1 ||
                        chunk.toString().indexOf('[fatal]') !== -1;
                    if (this.parameters[0].debug && !isError) {
                        this.log.debug(this.name, 'ffmpeg log message:\n' + chunk.toString());
                    }
                    else if (isError) {
                        this.log.error(this.name, 'ffmpeg log message:\n' + chunk.toString());
                    }
                });
                this.process.on('error', this.onProcessError.bind(this));
                this.process.on('exit', this.onProcessExit.bind(this));
            });
        });
    }
    async *parseFragmentedMP4(socket) {
        while (true) {
            const header = await this.readLength(socket, 8);
            const length = header.readInt32BE(0) - 8;
            const type = header.slice(4).toString();
            const data = await this.readLength(socket, length);
            yield {
                header,
                length,
                type,
                data,
            };
        }
    }
    async readLength(socket, length) {
        if (length <= 0) {
            return Buffer.alloc(0);
        }
        const value = socket.read(length);
        if (value) {
            return value;
        }
        return new Promise((resolve, reject) => {
            const readHandler = () => {
                const value = socket.read(length);
                if (value) {
                    cleanup();
                    resolve(value);
                }
            };
            const endHandler = () => {
                cleanup();
                reject(new Error(`FFMPEG socket closed during read for ${length} bytes!`));
            };
            const cleanup = () => {
                socket.removeListener('readable', readHandler);
                socket.removeListener('close', endHandler);
            };
            if (!socket) {
                throw new Error('FFMPEG socket is closed now!');
            }
            socket.on('readable', readHandler);
            socket.on('close', endHandler);
        });
    }
    stop() {
        var _a, _b, _c;
        let usesStdIn = false;
        this.parameters.forEach(p => {
            if (p.usesStdInAsInput()) {
                usesStdIn = true;
            }
        });
        if (usesStdIn) {
            (_a = this.process) === null || _a === void 0 ? void 0 : _a.stdin.destroy();
            (_b = this.process) === null || _b === void 0 ? void 0 : _b.kill('SIGTERM');
        }
        else {
            (_c = this.process) === null || _c === void 0 ? void 0 : _c.stdin.write('q' + os_1.default.EOL);
        }
        this.killTimeout = setTimeout(() => {
            var _a;
            (_a = this.process) === null || _a === void 0 ? void 0 : _a.kill('SIGKILL');
        }, 2 * 1000);
    }
    onProgressStarted() {
        this.emit('started');
        const runtime = this.starttime ? (Date.now() - this.starttime) / 1000 : undefined;
        this.log.debug(this.name, `process started. Getting the first response took ${runtime} seconds.`);
    }
    onProcessError(error) {
        this.emit('error', error);
    }
    onProcessExit(code, signal) {
        var _a;
        this.emit('exit');
        if (this.killTimeout) {
            clearTimeout(this.killTimeout);
        }
        const message = 'FFmpeg exited with code: ' + code + ' and signal: ' + signal;
        if (this.killTimeout && code === 0) {
            this.log.info(this.name, message + ' (Expected)');
        }
        else if (code === null || code === 255) {
            if ((_a = this.process) === null || _a === void 0 ? void 0 : _a.killed) {
                this.log.info(this.name, message + ' (Forced)');
            }
            else {
                this.log.error(this.name, message + ' (Unexpected)');
            }
        }
        else {
            this.emit('error', message + ' (Error)');
            // this.log.error(this.name, message + ' (Error)');
        }
    }
}
exports.FFmpeg = FFmpeg;
//# sourceMappingURL=ffmpeg.js.map