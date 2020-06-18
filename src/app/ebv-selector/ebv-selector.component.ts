import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {
    Config,
    DataType,
    DataTypes,
    GdalSourceParameterOptions,
    GdalSourceType,
    Interpolation,
    Layer,
    MappingRasterSymbology,
    MappingRequestParameters,
    Operator,
    ParameterOptionType,
    ParametersType,
    Projections,
    ProjectService,
    RasterLayer,
    ResultTypes,
    Unit,
    UserService,
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

    // TODO: set higher
    readonly SUBGROUP_SEARCH_THRESHOLD = 3;
    readonly loading$ = new BehaviorSubject(true);

    ebvClasses: Array<EbvClass> = undefined;
    ebvClass: EbvClass = undefined;
    ebvNames: Array<string> = undefined;
    ebvName: string = undefined;
    ebvDatasets: Array<EbvDataset> = undefined;
    ebvDataset: EbvDataset = undefined;
    ebvSubgroups: Array<EbvSubgroup> = undefined;
    ebvSubgroupValueOptions: Array<Array<EbvSubgroupValue>> = [];
    ebvSubgroupValueOptions$: Array<Array<EbvSubgroupValue>> = [];
    ebvSubgroupValues: Array<EbvSubgroupValue> = [];

    private ebvDataLoadingInfo: EbvDataLoadingInfo = undefined;

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
                this.ebvSubgroupValueOptions$ = [value_data.values.slice()];
            });
        });
    }

    setEbvSubgroupValue(subgroupIndex: number, subgroupValue: EbvSubgroupValue) {
        this.ebvSubgroupValues[subgroupIndex] = subgroupValue;

        const ebv_path = this.ebvDataset.dataset_path;

        if (subgroupIndex === this.ebvSubgroups.length - 1) { // entity is selected
            this.request<EbvDataLoadingInfo>('data_loading_info', {
                ebv_path,
                ebv_entity_path: this.ebvSubgroupValues.map(value => value.name).join('/'),
            }, data => {
                this.ebvDataLoadingInfo = data;
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
            this.ebvSubgroupValueOptions$.push(value_data.values.slice());
        });
    }

    filterEbvSubgroupValueOptions(i: number, filterValue: string) {
        filterValue = filterValue.toLowerCase();

        this.ebvSubgroupValueOptions$[i].length = 0;
        for (const valueOption of this.ebvSubgroupValueOptions[i]) {
            if (valueOption.label.toLowerCase().indexOf(filterValue) < 0) {
                continue;
            }
            this.ebvSubgroupValueOptions$[i].push(valueOption);
        }
    }

    isAddButtonVisible(): boolean {
        if (!this.ebvSubgroups || !this.ebvSubgroupValues || !this.ebvDataLoadingInfo) {
            return false;
        }
        return this.ebvSubgroups.length === this.ebvSubgroupValues.length; // all groups have a selected value
    }

    showEbv() {
        const path = this.ebvDataset.dataset_path;
        const netCdfSubdataset = '/' + this.ebvSubgroupValues.map(value => value.name).join('/');

        const timePoints = this.ebvDataLoadingInfo.time_points;
        const deltaUnit = this.ebvDataLoadingInfo.delta_unit;

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

        const timePoints = this.ebvDataLoadingInfo.time_points;
        const readableTimePoints = timePoints.map(t => moment.unix(t).utc().format());
        const deltaUnit = this.ebvDataLoadingInfo.delta_unit;
        const crsCode = this.ebvDataLoadingInfo.crs_code;

        const ebvDataTypeCode = 'Float32';
        const ebvProjectionCode = crsCode ? crsCode : Projections.WGS_84.getCode();

        const ebvUnit = new Unit({
            interpolation: Interpolation.Continuous,
            measurement: Unit.defaultUnit.measurement,
            unit: Unit.defaultUnit.unit,
            min: this.ebvDataLoadingInfo.unit_range[0],
            max: this.ebvDataLoadingInfo.unit_range[1],
        });

        const operatorType = new GdalSourceType({
            channelConfig: {
                channelNumber: 0,
                displayValue: (readableTimePoints.length > 0) ? readableTimePoints[0] : 'no time avaliable',
            },
            sourcename: this.ebvDataset.name,
            transform: false, // TODO: user selectable transform?
            gdal_params: {
                channels: timePoints.map((t, i) => {
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
                    citation: this.ebvDataset.name,
                    license: this.ebvDataset.license,
                    uri: '',
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

        return new RasterLayer<MappingRasterSymbology>({
            name: this.ebvName,
            operator: sourceOperator,
            symbology: MappingRasterSymbology.createSymbology({unit: ebvUnit}),
        });
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
                this.ebvSubgroupValueOptions$.length = 0;
                this.ebvDataLoadingInfo = undefined;
                break;
            default: // subgroup
                if (subgroupIndex !== undefined) {
                    this.ebvSubgroupValues.length = subgroupIndex + 1;
                    this.ebvSubgroupValueOptions.length = subgroupIndex + 1;
                    this.ebvSubgroupValueOptions$.length = subgroupIndex + 1;
                    this.ebvDataLoadingInfo = undefined;
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
    unit_range: [number, number];
}
