import {Injectable} from '@angular/core';
import {mergeDeep} from 'immutable';
import {Config, WaveConfigStructure, WAVE_DEFAULT_CONFIG} from '@umr-dbs/wave-core';

interface EbvAnalyzer {
    readonly NETCDF: {};
}

interface AppConfigStructure extends WaveConfigStructure {
    readonly EBV_ANALYZER: EbvAnalyzer;
}

const APP_CONFIG_DEFAULTS = mergeDeep(WAVE_DEFAULT_CONFIG, {
    EBV_ANALYZER: {
        NETCDF: {}
    },
}) as AppConfigStructure;

@Injectable()
export class AppConfig extends Config {
    protected config: AppConfigStructure;

    get EBV_ANALYZER(): EbvAnalyzer {
        return this.config.EBV_ANALYZER;
    }

    load(): Promise<void> {
        return super.load(APP_CONFIG_DEFAULTS);
    }
}
