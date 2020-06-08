import {Observable} from 'rxjs';
import { map, distinct, distinctUntilChanged } from 'rxjs/operators';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnInit,
    ViewChild,
    ViewContainerRef,
} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatIconRegistry} from '@angular/material/icon';
import {MatSidenav} from '@angular/material/sidenav';
import {MatTabGroup} from '@angular/material/tabs';
import {
    Layer,
    SidenavContainerComponent,
    MapContainerComponent,
    AbstractSymbology,
    LayoutService,
    ProjectService,
    UserService,
    StorageService,
    RandomColorService,
    MappingQueryService,
    NotificationService,
    MapService,
    Config,
    ResultTypes,
    LayerListWorkflowParameterSliderComponent,
    TimePoint,
} from '@umr-dbs/wave-core';
import {DomSanitizer} from '@angular/platform-browser';
import {ActivatedRoute} from '@angular/router';
import {AppConfig} from './app-config.service';
import * as moment from 'moment';

@Component({
    selector: 'wave-app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit {
    @ViewChild(MapContainerComponent, {static: true}) mapComponent: MapContainerComponent;
    @ViewChild(MatTabGroup, {static: true}) bottomTabs: MatTabGroup;

    @ViewChild(MatSidenav, {static: true}) rightSidenav: MatSidenav;
    @ViewChild(SidenavContainerComponent, {static: true}) rightSidenavContainer: SidenavContainerComponent;

    readonly ResultTypes = ResultTypes;

    layersReverse$: Observable<Array<Layer<AbstractSymbology>>>;

    mapIsGrid$: Observable<boolean>;

    constructor(@Inject(Config) readonly config: AppConfig,
                private readonly layoutService: LayoutService,
                private readonly projectService: ProjectService,
                private readonly vcRef: ViewContainerRef, // reference used by color picker
                private readonly userService: UserService,
                private readonly storageService: StorageService,
                private readonly changeDetectorRef: ChangeDetectorRef,
                private readonly dialog: MatDialog,
                private readonly iconRegistry: MatIconRegistry,
                private readonly randomColorService: RandomColorService,
                private readonly mappingQueryService: MappingQueryService,
                private readonly activatedRoute: ActivatedRoute,
                private readonly notificationService: NotificationService,
                private readonly mapService: MapService,
                private readonly sanitizer: DomSanitizer) {
        this.registerIcons();
    }

    private registerIcons() {
        this.iconRegistry.addSvgIconInNamespace(
            'vat',
            'logo',
            this.sanitizer.bypassSecurityTrustResourceUrl('assets/vat_logo.svg'),
        );

        // used for navigation
        this.iconRegistry.addSvgIcon('cogs', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/cogs.svg'));

        this.iconRegistry.addSvgIconInNamespace(
            'geobon',
            'logo',
            this.sanitizer.bypassSecurityTrustResourceUrl('assets/geobon-logo.svg'),
        );
    }

    getFirstLayerStream(): Observable<Layer<AbstractSymbology> | undefined> {
        return this.projectService.getLayerStream().pipe(
            map(layers => {
                if (layers && layers.length > 0) {
                    return layers[0];
                }
                return undefined;
            },
            distinctUntilChanged())
        );
    }

    ngOnInit() {
        this.mapService.registerMapComponent(this.mapComponent);
        this.layersReverse$ = this.projectService.getLayerStream();

        this.projectService.setTime(new TimePoint(moment.utc()));
    }

    ngAfterViewInit() {
    }

}
