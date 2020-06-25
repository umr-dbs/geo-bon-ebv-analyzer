import {ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {
    AbstractRasterSymbology,
    Config,
    DataType,
    DataTypes,
    GdalSourceParameterOptions,
    GdalSourceType,
    Interpolation,
    Layer, MappingQueryService,
    MappingRasterSymbology,
    MappingRequestParameters,
    Operator,
    ParameterOptionType,
    ParametersType, PlotData,
    Projections,
    ProjectService,
    RasterLayer,
    ResultTypes, StatisticsType,
    Unit,
    UserService,
} from '@umr-dbs/wave-core';
import {BehaviorSubject, combineLatest, concat, Observable, Subscription} from 'rxjs';
import * as moment from 'moment';
import {AppConfig} from '../app-config.service';
import {first, map} from 'rxjs/operators';
import {TimePoint} from '@umr-dbs/wave-core';
import {TimeService, TimeStep} from '../time-available.service';
import {DataPoint} from '../indicator-plot/indicator-plot.component';
import { CountryProviderService, Country } from '../country-provider.service';


@Component({
    selector: 'wave-ebv-ebv-selector',
    templateUrl: './ebv-selector.component.html',
    styleUrls: ['./ebv-selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EbvSelectorComponent implements OnInit, OnDestroy {

    readonly SUBGROUP_SEARCH_THRESHOLD = 5;
    readonly loading$ = new BehaviorSubject(true);
    readonly isLayerLoaded$: Observable<boolean>;

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

    plotSettings: {
        data$: Observable<DataPoint>,
        xLimits: [number, number],
        yLimits: [number, number],
        yLabel: string,
    } = undefined;

    private ebvDataLoadingInfo: EbvDataLoadingInfo = undefined;

    private userSubscription: Subscription = undefined;

    constructor(private readonly userService: UserService,
                @Inject(Config) private readonly config: AppConfig,
                private readonly changeDetectorRef: ChangeDetectorRef,
                private readonly http: HttpClient,
                private readonly projectService: ProjectService,
                private readonly timeService: TimeService,
                private readonly mappingQueryService: MappingQueryService,
                private readonly countryProviderService: CountryProviderService) {
        this.isLayerLoaded$ = this.projectService
            .getLayerStream()
            .pipe(map(layers => layers.length > 0));
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

        // set time
        const timeAsMoments = timePoints.map(t => moment.unix(t).utc()); // TODO: only one map
        const times = timeAsMoments.map(
            m => {
                const time = new TimePoint(m);
                return {
                    time,
                    displayValue: time.toString()
                };
            }
        );
        this.timeService.setAvailableTimeSteps(times);
        this.projectService.setTime(times[0].time);

        // generate a new layer
        const layer = this.generateGdalSourceNetCdfLayer();
        this.projectService.addLayer(layer);

    }

    private generateGdalSourceNetCdfLayer(): Layer<MappingRasterSymbology> {

        const path = this.ebvDataset.dataset_path;
        const netCdfSubdataset = '/' + this.ebvSubgroupValues.map(value => value.name).join('/');

        const timePoints = this.ebvDataLoadingInfo.time_points;
        const readableTimePoints = timePoints.map(t => moment.unix(t).utc().format());
        const endBound = moment.unix(timePoints[timePoints.length - 1]).add(1, 'days');

        const deltaUnit = this.ebvDataLoadingInfo.delta_unit; // TODO: incorporate delta to time formatting
        const crsCode = this.ebvDataLoadingInfo.crs_code;

        const ebvDataTypeCode = 'Float32';
        const ebvProjectionCode = crsCode ? crsCode : Projections.WGS_84.getCode();

        let measurement = Unit.defaultUnit.measurement;
        const metricSubgroupIndex = this.ebvSubgroups.findIndex(subgroup => subgroup.name.toLowerCase() === 'metric');
        if (metricSubgroupIndex >= 0) {
            const metricValue = this.ebvSubgroupValues[metricSubgroupIndex];
            measurement = metricValue.name;
        }

        const ebvUnit = new Unit({
            interpolation: Interpolation.Continuous,
            measurement,
            unit: Unit.defaultUnit.unit,
            min: this.ebvDataLoadingInfo.unit_range[0],
            max: this.ebvDataLoadingInfo.unit_range[1],
        });

        const operatorType = new GdalSourceType({
            channelConfig: { // TODO: make channel config optional
                channelNumber: 0,
                displayValue: (readableTimePoints.length > 0) ? readableTimePoints[0] : 'no time avaliable',
            },
            sourcename: this.ebvDataset.name,
            transform: false,
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
                time_start: readableTimePoints[0],
                time_end: endBound.format(),
                channel_start_time_list: readableTimePoints,
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
            attributes: [Operator.RASTER_ATTRIBTE_NAME],
            dataTypes: new Map<string, DataType>().set(Operator.RASTER_ATTRIBTE_NAME, DataTypes.fromCode(ebvDataTypeCode)),
            units: new Map<string, Unit>().set(Operator.RASTER_ATTRIBTE_NAME, ebvUnit),
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

    plot() {
        combineLatest([
            this.projectService.getLayerStream(),
            this.timeService.availableTimeSteps,
            this.countryProviderService.getSelectedCountryStream()
        ]).pipe(
            first()
        ).subscribe(([layers, timeSteps, country]) => {
            if (!timeSteps || !layers || layers.length !== 1 || !country) {
                return;
            }

            const layer = layers[0] as RasterLayer<AbstractRasterSymbology>;

            const unit = layer.operator.getUnit(Operator.RASTER_ATTRIBTE_NAME);

            let yLabel = '';
            if (unit.measurement !== Unit.defaultUnit.measurement) {
                yLabel = `Mean value of »${unit.measurement}«`;
            }

            this.plotSettings = {
                data$: this.createPlotQueries(layer, timeSteps, country),
                xLimits: [0, timeSteps.length - 1],
                yLimits: [unit.min, unit.max],
                yLabel,
            };

            this.changeDetectorRef.markForCheck();
        });
    }

    private createPlotQueries(
        layer: RasterLayer<AbstractRasterSymbology>,
        timeSteps: Array<TimeStep>,
        country: Country
    ): Observable<DataPoint> {
        const plotRequests: Array<Observable<PlotData>> = [];

        const heightToWidthRatio = 0.5; // TODO: calculate from bounds

        const statisticsOperatorType = new StatisticsType({
            raster_width: 1024,
            raster_height: Math.round(1024 * heightToWidthRatio),
        });

        // TODO: add the rasterclip!

        const operator = new Operator({
            operatorType: statisticsOperatorType,
            projection: layer.operator.projection,
            rasterSources: [layer.operator],
            resultType: ResultTypes.PLOT,
        });

        for (const timeStep of timeSteps) {

            plotRequests.push(
                this.mappingQueryService.getPlotData({
                    extent: operator.projection.getExtent(), // TODO: fit extent to known bounds
                    operator,
                    projection: operator.projection,
                    time: timeStep.time,
                })
            );
        }

        return concat(...plotRequests).pipe(
            map((_plotData, timeIndex) => {
                const plotData = _plotData as any as PlotResult;

                return {
                    time: timeIndex,
                    time_label: timeSteps[timeIndex].displayValue,
                    value: plotData.data.rasters[0].mean,
                };
            }),
        );
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

interface PlotResult {
    type: 'LayerStatistics';
    data: {
        rasters: Array<{
            count: number,
            max: number,
            mean: number,
            min: number,
            nan_count: number,
        }>,
    };
}
