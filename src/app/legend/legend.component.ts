import {Component, OnInit, ChangeDetectionStrategy, Input, OnChanges, SimpleChanges, ChangeDetectorRef} from '@angular/core';
import {MappingRasterSymbology, RasterLayer, ProjectService} from '@umr-dbs/wave-core';

@Component({
    selector: 'wave-ebv-legend',
    templateUrl: './legend.component.html',
    styleUrls: ['./legend.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegendComponent implements OnInit, OnChanges {
    @Input() layer: RasterLayer<MappingRasterSymbology> = undefined;

    constructor(readonly changeDetectorRef: ChangeDetectorRef) {
    }
    ngOnChanges(changes: SimpleChanges): void {
        this.changeDetectorRef.markForCheck();
    }

    ngOnInit(): void {
    }

}
