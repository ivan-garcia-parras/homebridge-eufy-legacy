import { Component, Input, OnInit } from '@angular/core';
import { Accessory } from '../../../app/accessory';
import { PluginService } from '../../../app/plugin.service';
import { ConfigOptionsInterpreter } from '../config-options-interpreter';

import { VideoConfig } from '../../../../plugin/utils/configTypes';

import { faQuestionCircle } from '@fortawesome/free-regular-svg-icons';

@Component({
  selector: 'app-advanced-videoconfig',
  templateUrl: './advanced-videoconfig.component.html',
  styleUrls: ['./advanced-videoconfig.component.css'],
})
export class AdvancedVideoconfigComponent
  extends ConfigOptionsInterpreter
  implements OnInit {

  faQuestionCircle = faQuestionCircle;

  constructor(pluginService: PluginService) {
    super(pluginService);
  }

  ngOnInit(): void {
    this.readValue();
  }

  /** Customize from here */
  /** updateConfig() will overwrite any settings that you'll provide */
  /** Don't try and 'append'/'push' to arrays this way - add a custom method instead */
  /** see config option to ignore devices as example */

  /** updateConfig() takes an optional second parameter to specify the accessoriy for which the setting is changed */

  @Input() accessory?: Accessory;

  debug: boolean | undefined = undefined;
  readRate: boolean | undefined = undefined;
  vcodec: string | undefined = undefined;
  acodec: string | undefined = undefined;
  videoFilter: string | undefined = undefined;
  encoderOptions: string | undefined = undefined;
  probeSize: number | undefined = undefined;
  analyzeDuration: number | undefined = undefined;
  maxStreams: number | undefined = undefined;
  maxWidth: number | undefined = undefined;
  maxHeight: number | undefined = undefined;
  maxFPS: number | undefined = undefined;
  maxBitrate: number | undefined = undefined;
  useSeparateProcesses: boolean | undefined = undefined;
  crop: boolean | undefined = undefined;
  audioSampleRate: number | undefined = undefined;
  audioBitrate: number | undefined = undefined;
  acodecHK: string | undefined = undefined;
  acodecOptions: string | undefined = undefined;
  videoProcessor: string | undefined = undefined;

  preset = 0;
  presetDescription?: string;

  acodecPlaceholder = 'libfdk_aac';
  acodecOptionsPlaceholder = '-profile:a aac_eld';
  vcodecOptionsPlaceholder = '-preset ultrafast -tune zerolatency';

  async readValue() {
    const config = await this.getCameraConfig(this.accessory?.uniqueId || '');

    if (config && Object.prototype.hasOwnProperty.call(config, 'videoConfig')) {
      Object.entries(config['videoConfig']).forEach(([key, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = this as any;
        obj[key] = value;
      });
    }

    this.placeholderUpdate();
    this.updatePreset();
  }

  private placeholderUpdate() {
    switch (this.acodecHK) {
      case 'ACC-eld':
        this.acodecPlaceholder = 'libfdk_aac';
        this.acodecOptionsPlaceholder = '-profile:a aac_eld';
        break;
      case 'OPUS':
        this.acodecPlaceholder = 'libopus';
        this.acodecOptionsPlaceholder = '-application lowdelay';
        break;
      default:
        this.acodecPlaceholder = 'libfdk_aac';
        this.acodecOptionsPlaceholder = '-profile:a aac_eld';
        break;
    }

    switch (this.vcodec) {
      case 'copy':
        this.vcodecOptionsPlaceholder = '';
        break;
      case '':
      case 'libx264':
      case undefined:
        this.vcodecOptionsPlaceholder = '-preset ultrafast -tune zerolatency';
        break;
      default:
        this.vcodecOptionsPlaceholder = 'leave blank if you don\'t know';
        break;
    }
  }

  loadPreset() {
    if (this.preset === 0) {
      this.readRate = undefined;
      this.vcodec = undefined;
      this.acodec = undefined;
      this.videoFilter = undefined;
      this.encoderOptions = undefined;
      this.probeSize = undefined;
      this.analyzeDuration = undefined;
      this.maxStreams = undefined;
      this.maxWidth = undefined;
      this.maxHeight = undefined;
      this.maxFPS = undefined;
      this.maxBitrate = undefined;
      this.useSeparateProcesses = undefined;
      this.crop = undefined;

      this.presetDescription = undefined;
    } else if (this.preset === 1) {
      this.readRate = undefined;
      this.vcodec = 'copy';
      this.acodec = undefined;
      this.videoFilter = undefined;
      this.encoderOptions = undefined;
      this.probeSize = undefined;
      this.analyzeDuration = undefined;
      this.maxStreams = undefined;
      this.maxWidth = undefined;
      this.maxHeight = undefined;
      this.maxFPS = undefined;
      this.maxBitrate = undefined;
      this.useSeparateProcesses = true;
      this.crop = undefined;
      
      // eslint-disable-next-line max-len
      this.presetDescription = 'Most eufy cams support the same codec that HomeKit requests. You can try and \'forward\' the stream directly without encoding it with ffmpeg. This can increase performance and quality drastically.';
    } else if (this.preset === 2) {
      this.readRate = undefined;
      this.vcodec = undefined;
      this.acodec = undefined;
      this.videoFilter = undefined;
      this.encoderOptions = undefined;
      this.probeSize = undefined;
      this.analyzeDuration = undefined;
      this.maxStreams = undefined;
      this.maxWidth = 640;
      this.maxHeight = 480;
      this.maxFPS = 15;
      this.maxBitrate = undefined;
      this.useSeparateProcesses = true;
      this.crop = undefined;
      
      // eslint-disable-next-line max-len
      this.presetDescription = 'This preset tries to increase performance by reducing the quality of the stream. This can work for low performance hardware like raspberry pis.';
    } else {
      this.presetDescription = undefined;
    }

    this.update();
  }

  private updatePreset() {
    let p = 3;
    if (!this.readRate &&
      this.vcodec === undefined &&
      this.acodec === undefined &&
      this.videoFilter === undefined &&
      this.encoderOptions === undefined &&
      this.probeSize === undefined &&
      this.analyzeDuration === undefined &&
      this.maxStreams === undefined &&
      this.maxWidth === undefined &&
      this.maxHeight === undefined &&
      this.maxFPS === undefined &&
      this.maxBitrate === undefined &&
      this.useSeparateProcesses === undefined &&
      this.crop === undefined
    ) {
      p = 0;
    }
    if (!this.readRate &&
      this.vcodec === 'copy' &&
      this.acodec === undefined &&
      this.videoFilter === undefined &&
      this.encoderOptions === undefined &&
      this.probeSize === undefined &&
      this.analyzeDuration === undefined &&
      this.maxStreams === undefined &&
      this.maxWidth === undefined &&
      this.maxHeight === undefined &&
      this.maxFPS === undefined &&
      this.maxBitrate === undefined &&
      this.useSeparateProcesses === true &&
      this.crop === undefined
    ) {
      p = 1;
    }
    if (!this.readRate &&
      this.vcodec === undefined &&
      this.acodec === undefined &&
      this.videoFilter === undefined &&
      this.encoderOptions === undefined &&
      this.probeSize === undefined &&
      this.analyzeDuration === undefined &&
      this.maxStreams === undefined &&
      this.maxWidth === 640 &&
      this.maxHeight === 480 &&
      this.maxFPS === 15 &&
      this.maxBitrate === undefined &&
      this.useSeparateProcesses === true &&
      this.crop === undefined
    ) {
      p = 2;
    }

    if (p !== this.preset) {
      this.preset = p;
    }
  }

  async update() {
    const config = await this.getCameraConfig(this.accessory?.uniqueId || '');

    const videoConfig =
      config && Object.prototype.hasOwnProperty.call(config, 'videoConfig')
        ? config['videoConfig']
        : {};
    const newConfig: VideoConfig = {};

    if (Object.prototype.hasOwnProperty.call(videoConfig, 'audio')) {
      newConfig['audio'] = videoConfig['audio'];
    }
    if (this.debug) {
      newConfig['debug'] = this.debug;
    }
    if (this.readRate) {
      newConfig['readRate'] = this.readRate;
    }
    if (this.vcodec && this.vcodec !== '') {
      newConfig['vcodec'] = this.vcodec;
    }
    if (this.acodec && this.acodec !== '') {
      newConfig['acodec'] = this.acodec;
    }
    if (this.videoFilter && this.videoFilter !== '') {
      newConfig['videoFilter'] = this.videoFilter;
    }
    if (this.encoderOptions !== undefined) {
      newConfig['encoderOptions'] = this.encoderOptions;
    }
    if (this.probeSize !== undefined) {
      newConfig['probeSize'] = this.probeSize;
    }
    if (this.analyzeDuration !== undefined) {
      newConfig['analyzeDuration'] = this.analyzeDuration;
    }
    if (this.maxStreams !== undefined) {
      newConfig['maxStreams'] = this.maxStreams;
    }
    if (this.maxWidth !== undefined) {
      newConfig['maxWidth'] = this.maxWidth;
    }
    if (this.maxHeight !== undefined) {
      newConfig['maxHeight'] = this.maxHeight;
    }
    if (this.maxFPS !== undefined) {
      newConfig['maxFPS'] = this.maxFPS;
    }
    if (this.maxBitrate !== undefined) {
      newConfig['maxBitrate'] = this.maxBitrate;
    }
    if (this.useSeparateProcesses) {
      newConfig['useSeparateProcesses'] = this.useSeparateProcesses;
    }
    if (this.crop) {
      newConfig['crop'] = this.crop;
    }
    if (this.audioSampleRate !== undefined) {
      newConfig['audioSampleRate'] = this.audioSampleRate;
    }
    if (this.audioBitrate !== undefined) {
      newConfig['audioBitrate'] = this.audioBitrate;
    }
    if (this.acodecHK && this.acodecHK !== '') {
      newConfig['acodecHK'] = this.acodecHK;
    }
    if (this.acodecOptions !== undefined) {
      newConfig['acodecOptions'] = this.acodecOptions;
    }
    if (this.videoProcessor && this.videoProcessor !== '') {
      newConfig['videoProcessor'] = this.videoProcessor;
    }

    this.updateConfig(
      {
        videoConfig: newConfig,
      },
      this.accessory,
    );

    this.placeholderUpdate();
    this.updatePreset();
  }
}
