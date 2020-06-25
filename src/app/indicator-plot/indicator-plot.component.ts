import {Component, OnInit, ChangeDetectionStrategy, OnDestroy, ViewChild, ElementRef} from '@angular/core';
import {
    AbstractRasterSymbology,
    MappingQueryService,
    Operator, PlotData,
    ProjectService,
    RasterLayer,
    ResultTypes,
    StatisticsType
} from '@umr-dbs/wave-core';
import {BehaviorSubject, concat, Observable, Subscription} from 'rxjs';
import * as d3 from 'd3';
import {TimeService, TimeStep} from '../time-available.service';

@Component({
    selector: 'wave-ebv-indicator-plot',
    templateUrl: './indicator-plot.component.html',
    styleUrls: ['./indicator-plot.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicatorPlotComponent implements OnInit, OnDestroy {

    readonly ongoingQuery$ = new BehaviorSubject<boolean>(false);

    @ViewChild('svg', {static: true}) private readonly svgRef: ElementRef;

    private readonly strokeWidth = 2.5;
    private readonly strokeColor = '#00796a';

    private xScale: d3.ScaleLinear<number, number>;
    private yScale: d3.ScaleLinear<number, number>;
    private svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private xAxis: d3.Axis<d3.AxisDomain>;
    private yAxis: d3.Axis<d3.AxisDomain>;
    private xAxisGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private yAxisGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private availableTimeSteps: Array<TimeStep> | undefined = undefined;

    private layerSubscription: Subscription;
    private timeSubscription: Subscription;

    constructor(private readonly elementRef: ElementRef,
                private readonly projectService: ProjectService,
                private readonly mappingQueryService: MappingQueryService,
                private readonly timeService: TimeService) {
    }

    ngOnInit() {
        // TODO: re-init on browser window size change event
        this.initChart();

        this.layerSubscription = this.projectService.getLayerStream().subscribe(layers => {
            if (layers.length !== 1) {
                return;
            }

            const layer = layers[0] as RasterLayer<AbstractRasterSymbology>;
            if (this.availableTimeSteps) {
                this.processQueries(layer, this.availableTimeSteps);
            }
        });

        this.timeSubscription = this.timeService.availableTimeSteps.subscribe(timeSteps => {
            this.availableTimeSteps = timeSteps;
        });
    }

    private processQueries(layer: RasterLayer<AbstractRasterSymbology>, timeSteps: Array<TimeStep>) {
        const timePoints = timeSteps.map(t => t.time);
        const plotRequests: Array<Observable<PlotData>> = [];

        const statisticsOperatorType = new StatisticsType({
            raster_width: 1024,
            raster_height: 1024,
        });

        for (const timePoint of timePoints) {
            const operatorTypeOptions = {};

            const operator = new Operator({
                operatorType: statisticsOperatorType,
                projection: layer.operator.projection,
                rasterSources: [layer.operator],
                resultType: ResultTypes.PLOT,
            });

            plotRequests.push(
                this.mappingQueryService.getPlotData({
                    extent: operator.projection.getExtent(), // TODO: fit extent to known bounds
                    operator,
                    projection: operator.projection,
                    time: timePoint, // TODO: use time information
                })
            );
        }

        const totalPlotData: Array<DataPoint> = [];
        this.updateChart(totalPlotData);

        this.ongoingQuery$.next(true);

        let timeIndex = 0;
        concat(...plotRequests).subscribe(
            _plotData => {
                const plotData = _plotData as any as PlotResult;

                totalPlotData.push({
                    time: timeIndex, // TODO: use time
                    time_label: timeSteps[timeIndex].displayValue,
                    value: plotData.data.rasters[0].mean,
                });
                timeIndex++;

                this.updateChart(totalPlotData);
            },
            _ => {
                // TODO: react on error
            },
            () => {
                this.ongoingQuery$.next(false);
            },
        );
    }

    ngOnDestroy() {
        this.layerSubscription.unsubscribe();
        this.timeSubscription.unsubscribe();
    }

    private initChart() {
        // set the dimensions and margins of the graph
        const rawWidth = this.elementRef.nativeElement.clientWidth;
        const rawHeight = 0.8 * rawWidth;
        const margin = {top: 10, right: 30, bottom: 30, left: 50};
        const width = rawWidth - margin.left - margin.right;
        const height = rawHeight - margin.top - margin.bottom;

        // setup SVG element
        this.svg = d3.select(this.svgRef.nativeElement)
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform',
                'translate(' + margin.left + ',' + margin.top + ')');

        // init X axis
        this.xScale = d3.scaleLinear().range([0, width]);
        this.xAxis = d3.axisBottom(this.xScale);
        this.xAxisGroup = this.svg.append('g')
            .attr('transform', 'translate(0,' + height + ')');

        // init Y axis
        this.yScale = d3.scaleLinear().range([height, 0]);
        this.yAxis = d3.axisLeft(this.yScale);
        this.yAxisGroup = this.svg.append('g');

        // init axis labels
        this.svg.append('text') // y axis label
            .attr('transform', 'rotate(-90)')
            .attr('y', -margin.left)
            .attr('x', -height / 2)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text('Frequency'); // TODO: use unit mesurement
    }

    private updateChart(data: Array<DataPoint>) {
        // Create the X axis:
        this.xScale.domain([d3.min(data, d => d.time), d3.max(data, d => d.time)]);
        this.xAxisGroup
            .transition()
            .duration(250) // TODO: use smart duration
            .call(this.xAxis as any);

        // create the Y axis
        this.yScale.domain([d3.min(data, d => d.value), d3.max(data, d => d.value)]);
        this.yAxisGroup
            .transition()
            .duration(250) // TODO: use smart duration
            .call(this.yAxis as any);

        // Create a update selection: bind to the new data
        const updateSelection = this.svg
            .selectAll('.line')
            .data([data], (d: DataPoint) => d.time as any);

        // Updata the line
        updateSelection
            .enter()
            .append('path')
            .attr('class', 'line')
            .merge(updateSelection as any)
            .transition()
            .duration(250)// TODO: use smart duration
            .attr(
                'd',
                d3.line()
                    .x(d => this.xScale((d as any as DataPoint).time))
                    .y(d => this.yScale((d as any as DataPoint).value)) as any
            ).attr('fill', 'none')
            .attr('stroke', this.strokeColor)
            .attr('stroke-width', this.strokeWidth);
    }

}

interface DataPoint {
    time: number;
    time_label: string | number;
    value: number;
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
