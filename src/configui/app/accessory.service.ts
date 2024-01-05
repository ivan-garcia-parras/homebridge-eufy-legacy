import { Injectable } from '@angular/core';
import { ChargingStatus } from './util/eufy-security-client.utils';

@Injectable({
  providedIn: 'root',
})
export class AccessoryService {

  public async getChargingStatus(sn: string): Promise<ChargingStatus> {
    return window.homebridge.request('/getChargingStatus', sn);
  }

  public async setExperimentalRTSPStatus(sn: string, value: boolean): Promise<string> {
    return window.homebridge.request('/setExperimentalRTSP', { sn: sn, value: value});
  }

  public async getExperimentalRTSPStatus(sn: string): Promise<{ state: boolean; url?: string }> {
    return window.homebridge.request('/getExperimentalRTSPStatus', sn);
  }

  public async getStationsCamerasMapping(): Promise<unknown> {
    return window.homebridge.request('/getStationDeviceMapping');
  }

  public async getCamerasOnSameStation(sn: string, ignoredDevices: string[] = []): Promise<string[]> {
    
    try {
      const mapping = await this.getStationsCamerasMapping() as object;
      for (const devices of Object.values(mapping)) {
        if (Array.isArray(devices) && devices.indexOf(sn) > -1) {
          const result = [sn];
          for (const device of devices) {
            if (device !== sn && ignoredDevices.indexOf(device) === -1) {
              result.push(device as string);
            }
          }
          return Promise.resolve(result);
        }
      }

      // sn was not found in mapping
      throw new Error('no valid station - devices mapping was found');
    } catch (err) {
      return Promise.reject(err);
    }
  }
}
