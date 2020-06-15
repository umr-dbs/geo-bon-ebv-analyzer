import {Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Inject, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {
    Config,
    MappingRequestParameters,
    ParametersType,
    UserService,
    ProjectService,
    MappingRasterSymbology,
    Layer,
    GdalSourceType,
    ParameterOptionType,
    Operator,
    ResultTypes,
    DataTypes,
    DataType,
    Unit,
    Projections,
    Interpolation,
    RasterLayer,
    GdalSourceParameterOptions,
} from '@umr-dbs/wave-core';
import {BehaviorSubject, Subscription} from 'rxjs';
import * as moment from 'moment';
import {AppConfig} from '../app-config.service';

@Component({
    selector: 'wave-ebv-ebv-selector',
    templateUrl: './ebv-selector.component.html',
    styleUrls: ['./ebv-selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EbvSelectorComponent implements OnInit, OnDestroy {

    loading$ = new BehaviorSubject(true);

    ebvClasses: Array<EbvClass> = undefined;
    ebvClass: EbvClass = undefined;
    ebvCrsCode: string = undefined;
    ebvNames: Array<string> = undefined;
    ebvName: string = undefined;
    ebvDatasets: Array<EbvDataset> = undefined;
    ebvDataset: EbvDataset = undefined;
    ebvSubgroups: Array<EbvSubgroup> = undefined;
    ebvSubgroupValueOptions: Array<Array<EbvSubgroupValue>> = [];
    ebvSubgroupValues: Array<EbvSubgroupValue> = [];

    private ebvTimePoints: Array<number> = undefined;
    private ebvDeltaUnit: string;

    private userSubscription: Subscription = undefined;

    constructor(private userService: UserService,
                @Inject(Config) private config: AppConfig,
                private changeDetectorRef: ChangeDetectorRef,
                private http: HttpClient,
                private projectService: ProjectService) {
    }

    ngOnInit() {
        // react on user changes to get new list of classes with new session token
        // important if first user has invalid session to retry querying the catalog
        this.userSubscription = this.userService.getUserStream().subscribe(() => {
            this.request<EbvClassesResponse>('classes', undefined, data => {
                this.ebvClasses = data.classes;
            });
        });
    }

    ngOnDestroy() {
        if (this.userSubscription) {
            this.userSubscription.unsubscribe();
        }
    }

    setEbvClass(ebvClass: EbvClass) {
        if (this.ebvClass === ebvClass) {
            return;
        }

        this.ebvClass = ebvClass;

        this.clearAfter('ebvClass');

        this.ebvNames = ebvClass.ebv_names;
    }

    setEbvName(ebvName: string) {
        if (this.ebvName === ebvName) {
            return;
        }

        this.ebvName = ebvName;

        this.clearAfter('ebvName');

        this.request<EbvDatasetsResponse>('datasets', {ebv_name: ebvName}, data => {
            this.ebvDatasets = data.datasets;
        });
    }

    setEbvDataset(ebvDataset: EbvDataset) {
        if (this.ebvDataset === ebvDataset) {
            return;
        }

        this.ebvDataset = ebvDataset;

        this.clearAfter('ebvDataset');

        const ebv_path = this.ebvDataset.dataset_path;

        this.request<EbvSubgroupsResponse>('subgroups', {ebv_path}, data => {
            this.request<EbvSubgroupValuesResponse>('subgroup_values', {
                ebv_path,
                ebv_subgroup: data.subgroups[0].name,
                ebv_group_path: '',
            }, value_data => {
                this.ebvSubgroups = data.subgroups;
                this.ebvSubgroupValueOptions = [value_data.values];
            });
        });
    }

    setEbvSubgroupValue(subgroupIndex: number, subgroupValue: EbvSubgroupValue) {
        this.ebvSubgroupValues[subgroupIndex] = subgroupValue;

        const ebv_path = this.ebvDataset.dataset_path;

        if (subgroupIndex === this.ebvSubgroups.length - 1) { // entity is selected
            this.request<EbvDataLoadingInfo>('data_loading_info', {ebv_path}, data => {
                this.ebvTimePoints = data.time_points;
                this.ebvDeltaUnit = data.delta_unit;
                this.ebvCrsCode = data.crs_code;
            });

            return;
        }

        this.clearAfter('', subgroupIndex);

        this.request<EbvSubgroupValuesResponse>('subgroup_values', {
            ebv_path,
            ebv_subgroup: this.ebvSubgroups[subgroupIndex + 1].name,
            ebv_group_path: this.ebvSubgroupValues.map(value => value.name).join('/'),
        }, value_data => {
            this.ebvSubgroupValueOptions.push(value_data.values);
        });
    }

    isAddButtonVisible(): boolean {
        if (!this.ebvSubgroups || !this.ebvSubgroupValues || !this.ebvTimePoints) {
            return false;
        }
        return this.ebvSubgroups.length === this.ebvSubgroupValues.length; // all groups have a selected value
    }

    showEbv() {
        const path = this.ebvDataset.dataset_path;
        const netCdfSubdataset = '/' + this.ebvSubgroupValues.map(value => value.name).join('/');

        const timePoints = this.ebvTimePoints;
        const deltaUnit = this.ebvDeltaUnit;

        // TODO: delete log
        console.log('load', path, netCdfSubdataset);
        console.log('display', timePoints.map(t => moment.unix(t).utc().format()), 'in', deltaUnit);

        // remove layers
        this.projectService.clearLayers();

        // generate a new layer
        const layer = this.generateGdalSourceNetCdfLayer();
        this.projectService.addLayer(layer);

    }

    private generateGdalSourceNetCdfLayer(): Layer<MappingRasterSymbology> {

        const path = this.ebvDataset.dataset_path;
        const netCdfSubdataset = '/' + this.ebvSubgroupValues.map(value => value.name).join('/');

        const timePoints = this.ebvTimePoints;
        const readableTimePoints = timePoints.map(t => moment.utc().seconds(t).format());
        const deltaUnit = this.ebvDeltaUnit;

        const ebvDataTypeCode = 'Float32';
        const ebvProjectionCode = this.ebvCrsCode ? this.ebvCrsCode : 'EPSG:4326';

        const ebvUnit = new Unit({
            interpolation: Interpolation.Continuous,
            measurement: 'raw',
            unit: 'raw',
            min: -35,
            max: 35
        });

        const operatorType = new GdalSourceType({
            channelConfig: {
                channelNumber: 0,
                displayValue: (readableTimePoints.length > 0) ? readableTimePoints[0] : 'no time avaliable',
            },
            sourcename: this.ebvDataset.name,
            transform: false, // TODO: user selectable transform?
            gdal_params: {
                channels: this.ebvTimePoints.map((t, i) => {
                    return {
                        channel: (i + 1),
                        datatype: ebvDataTypeCode,
                        unit: ebvUnit,
                        file_name: path,
                        netcdf_subdataset: netCdfSubdataset,
                    };
                }),
                file_name: path,
                coords: {
                    crs: ebvProjectionCode
                },
                provenance: {
                    citation: 'TODO',
                    license: 'TODO',
                    uri: 'TO.DO'
                }
            }
        });

        const operatorParameterOptions = new GdalSourceParameterOptions({
            operatorType: operatorType.toString(),
            channelConfig: {
                kind: ParameterOptionType.DICT_ARRAY,
                options: readableTimePoints.map((c, i) => {
                    return {
                        channelNumber: i,
                        displayValue: c,
                    };
                }),
            }
        });

        const sourceOperator = new Operator({
            operatorType,
            operatorTypeParameterOptions: operatorParameterOptions,
            resultType: ResultTypes.RASTER,
            projection: Projections.fromCode(ebvProjectionCode),
            attributes: ['value'],
            dataTypes: new Map<string, DataType>().set('value', DataTypes.fromCode(ebvDataTypeCode)),
            units: new Map<string, Unit>().set('value', ebvUnit),
        });

        const rasterLayer = new RasterLayer<MappingRasterSymbology>({
            name: this.ebvName,
            operator: sourceOperator,
            symbology: MappingRasterSymbology.createSymbology({unit: ebvUnit}),
        });

        return rasterLayer;
    }

    private request<T>(request, parameters: ParametersType, dataCallback: (T) => void) {
        this.loading$.next(true);

        const ebvDatasetsRequest = new MappingRequestParameters({
            service: 'geo_bon_catalog',
            request,
            parameters,
            sessionToken: this.userService.getSession().sessionToken,
        });
        this.http.get<T>(`${this.config.MAPPING_URL}?${ebvDatasetsRequest.toMessageBody()}`).subscribe(data => {
            dataCallback(data);

            this.changeDetectorRef.markForCheck();
            this.loading$.next(false);
        });
    }

    private clearAfter(field: string, subgroupIndex?: number) {
        switch (field) {
            case 'ebvClass':
                this.ebvNames = undefined;
                this.ebvName = undefined;
            // falls through
            case 'ebvName':
                this.ebvDatasets = undefined;
                this.ebvDataset = undefined;
            // falls through
            case 'ebvDataset':
                this.ebvSubgroups = undefined;
                this.ebvSubgroupValues.length = 0;
                this.ebvSubgroupValueOptions.length = 0;
                this.ebvTimePoints = undefined;
                break;
            default: // subgroup
                if (subgroupIndex !== undefined) {
                    this.ebvSubgroupValues.length = subgroupIndex + 1;
                    this.ebvSubgroupValueOptions.length = subgroupIndex + 1;
                    this.ebvTimePoints = undefined;
                }
        }
    }
}

interface EbvClass {
    name: string;
    ebv_names: Array<string>;
}

interface EbvClassesResponse {
    result: true;
    classes: Array<EbvClass>;
}

interface EbvDataset {
    id: string;
    name: string;
    author: string;
    description: string;
    license: string;
    dataset_path: string;
}

interface EbvDatasetsResponse {
    result: true;
    datasets: Array<EbvDataset>;
}

interface EbvSubgroup {
    name: string;
    description: string;
}

interface EbvSubgroupsResponse {
    result: true;
    subgroups: Array<EbvSubgroup>;
}

interface EbvSubgroupValue {
    name: string;
    label: string;
    description: string;
}

interface EbvSubgroupValuesResponse {
    result: true;
    values: Array<EbvSubgroupValue>;
}

interface EbvDataLoadingInfo {
    result: true;
    time_points: Array<number>;
    delta_unit: string;
    crs_code: string;
}
