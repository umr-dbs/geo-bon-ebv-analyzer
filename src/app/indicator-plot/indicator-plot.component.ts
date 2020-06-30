import {
    Component,
    OnInit,
    ChangeDetectionStrategy,
    OnDestroy,
    ViewChild,
    ElementRef,
    Input,
    OnChanges,
    SimpleChanges,
    HostListener
} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import * as d3 from 'd3';

@Component({
    selector: 'wave-ebv-indicator-plot',
    templateUrl: './indicator-plot.component.html',
    styleUrls: ['./indicator-plot.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicatorPlotComponent implements OnInit, OnDestroy, OnChanges {

    @Input() data: Observable<DataPoint>;
    @Input() xLimits: [number, number];
    @Input() yLabel: string;
    @Input() yLimits: [number, number];

    @ViewChild('svg', {static: true}) private readonly svgRef: ElementRef;
    readonly ongoingQuery$ = new BehaviorSubject<boolean>(false);

    private dataSubscription: Subscription;

    private readonly dataPoints: Array<DataPoint> = [];

    private readonly strokeWidth = 2.5;
    private readonly strokeColor = '#00796a';
    private readonly updateDelayMs = 250;

    private width: number;
    private height: number;
    private readonly margin = {top: 10, right: 30, bottom: 80, left: 60};

    private svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private xScale: d3.ScalePoint<number>;
    private yScale: d3.ScaleLinear<number, number>;
    private xAxis: d3.Axis<d3.AxisDomain>;
    private yAxis: d3.Axis<d3.AxisDomain>;
    private xAxisGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private yAxisGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private xLabelText: d3.Selection<SVGTextElement, unknown, HTMLElement, any>;
    private yLabelText: d3.Selection<SVGTextElement, unknown, HTMLElement, any>;

    constructor(private readonly elementRef: ElementRef) {
    }

    ngOnInit() {
        this.initChart();
        this.updateChart();
    }

    ngOnChanges(changes: SimpleChanges) {
        for (const property in changes) {
            if (!changes.hasOwnProperty(property)) {
                continue;
            }
            const value = changes[property].currentValue;
            switch (property) {
                case 'data':
                    if (this.dataSubscription) {
                        this.dataSubscription.unsubscribe();
                    }
                    this.dataPoints.length = 0;

                    this.ongoingQuery$.next(true);
                    this.dataSubscription = (value as Observable<DataPoint>).subscribe(
                        v => {
                            this.dataPoints.push(v);
                            if (this.svg) {
                                this.updateChart();
                            }
                        },
                        () => {
                        },
                        () => this.ongoingQuery$.next(false),
                    );
                    break;
                case 'xLimits':
                    this.createOrUpdateXScale();
                    break;
                case 'yLabel':
                    if (!this.yLabelText) {
                        return;
                    }

                    this.yLabelText.text(value);
                    break;
                case 'yLimits':
                    if (!this.yScale) {
                        return;
                    }

                    this.yScale.domain(value);
                    break;
            }
        }
    }

    ngOnDestroy() {
        if (this.dataSubscription) {
            this.dataSubscription.unsubscribe();
        }
    }

    @HostListener('window:resize')
    private windowResize() {
        // delete the old plot and redraw on window resize
        this.svgRef.nativeElement.innerHTML = '';
        this.initChart();
        this.updateChart();
    }

    private initChart() {
        // set the dimensions and margins of the graph
        const rawWidth = this.elementRef.nativeElement.clientWidth;
        const rawHeight = 0.8 * rawWidth;
        this.width = rawWidth - this.margin.left - this.margin.right;
        this.height = rawHeight - this.margin.top - this.margin.bottom;

        // setup SVG element
        this.svg = d3.select(this.svgRef.nativeElement)
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform',
                'translate(' + this.margin.left + ',' + this.margin.top + ')');

        // init X axis
        this.createOrUpdateXScale();
        this.xAxis = d3.axisBottom(this.xScale)
            .tickFormat((value, index) => {
                const dataPoint = this.dataPoints[index];
                return dataPoint ? dataPoint.time_label : '';
            });
        this.xAxisGroup = this.svg.append('g')
            .attr('transform', 'translate(0,' + this.height + ')');

        // init Y axis
        this.yScale = d3.scaleLinear()
            .range([this.height, 0])
            .domain(this.yLimits);
        this.yAxis = d3.axisLeft(this.yScale);
        this.yAxisGroup = this.svg.append('g');

        // init axis labels
        this.xLabelText = this.svg.append('text')
            .attr('text-anchor', 'end')
            .attr('x', this.width)
            .attr('y', this.height - 6)
            .text('Time');

        this.yLabelText = this.svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -this.margin.left)
            .attr('x', -this.height / 2)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .text(this.yLabel);
    }

    private updateChart() {
        if (this.dataPoints.length <= 0) {
            return;
        }

        // Update the X axis:
        this.xAxisGroup
            .transition()
            .duration(this.updateDelayMs)
            .call(this.xAxis as any)
            .selectAll('text')// rotate axis
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-65)');

        // Update the Y axis
        this.yAxisGroup
            .transition()
            .duration(this.updateDelayMs)
            .call(this.yAxis as any);

        // Create a update selection: bind to the new data
        const updateSelection = this.svg
            .selectAll('.line')
            .data([this.dataPoints], (d: DataPoint) => d.time as any);

        // Update the line
        updateSelection
            .enter()
            .append('path')
            .attr('class', 'line')
            .merge(updateSelection as any)
            .transition()
            .duration(this.updateDelayMs)
            .attr(
                'd',
                d3.line()
                    .x(d => this.xScale((d as any as DataPoint).time))
                    .y(d => this.yScale((d as any as DataPoint).value)) as any
            ).attr('fill', 'none')
            .attr('stroke', this.strokeColor)
            .attr('stroke-width', this.strokeWidth);

        setTimeout(() => this.updateBottomMargin());
    }

    private updateBottomMargin() {
        const additionalMargin = 10;

        const xTicksBBox = this.xAxisGroup.selectAll<SVGTextElement, unknown>('text').node().getBBox();
        this.margin.bottom = xTicksBBox.width + additionalMargin;
        d3.select(this.svgRef.nativeElement)
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom);
    }

    private createOrUpdateXScale() {
        if (!this.xScale) {
            this.xScale = d3.scalePoint<number>();
        }

        const upperLimit = this.xLimits[1];

        this.xScale
            .range([0, this.width])
            .domain([...Array(upperLimit + 1).keys()]);
    }

}

export interface DataPoint {
    time: number;
    time_label: string;
    value: number;
}
