import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {MappingRasterSymbology, RasterLayer} from '@umr-dbs/wave-core';
import {BehaviorSubject, Observable} from 'rxjs';

@Component({
    selector: 'wave-ebv-legend',
    templateUrl: './legend.component.html',
    styleUrls: ['./legend.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegendComponent implements OnInit {
    ebvLayer$: Observable<RasterLayer<MappingRasterSymbology>>;

    constructor() {
        // TODO: map raster to var
        this.ebvLayer$ = new BehaviorSubject(undefined);
    }

    ngOnInit(): void {
    }

}
