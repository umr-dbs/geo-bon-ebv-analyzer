import {Observable, BehaviorSubject} from 'rxjs';
import {map, first} from 'rxjs/operators';

import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    HostListener,
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
    PlotListComponent,
    WorkflowParameterChoiceDialogComponent,
} from '@umr-dbs/wave-core';
import {DomSanitizer} from '@angular/platform-browser';
import {ActivatedRoute} from '@angular/router';
import {AppConfig} from './app-config.service';

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

    readonly layersReverse$: Observable<Array<Layer<AbstractSymbology>>>;
    readonly layerListVisible$: Observable<boolean>;
    readonly layerDetailViewVisible$: Observable<boolean>;

    mapIsGrid$: Observable<boolean>;

    private windowHeight$ = new BehaviorSubject<number>(window.innerHeight);

    constructor(@Inject(Config) readonly config: AppConfig,
                readonly layoutService: LayoutService,
                readonly projectService: ProjectService,
                readonly vcRef: ViewContainerRef, // reference used by color picker
                private userService: UserService,
                private storageService: StorageService,
                private changeDetectorRef: ChangeDetectorRef,
                private dialog: MatDialog,
                private iconRegistry: MatIconRegistry,
                private randomColorService: RandomColorService,
                private mappingQueryService: MappingQueryService,
                private activatedRoute: ActivatedRoute,
                private notificationService: NotificationService,
                private mapService: MapService,
                private sanitizer: DomSanitizer) {
        this.registerIcons();

        vcRef.length; // tslint:disable-line:no-unused-expression // just get rid of unused warning

        this.storageService.toString(); // just register

        this.layersReverse$ = this.projectService.getLayerStream().pipe(
            map(layers => layers.slice(0).reverse())
        );

        this.layerListVisible$ = this.layoutService.getLayerListVisibilityStream();
        this.layerDetailViewVisible$ = this.layoutService.getLayerDetailViewVisibilityStream();
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

    ngOnInit() {
        this.mapService.registerMapComponent(this.mapComponent);
        this.mapIsGrid$ = this.mapService.isGrid$;
    }

    ngAfterViewInit() {
        this.layoutService.getSidenavContentComponentStream().subscribe(sidenavConfig => {
            this.rightSidenavContainer.load(sidenavConfig);
            if (sidenavConfig) {
                this.rightSidenav.open();
            } else {
                this.rightSidenav.close();
            }
        });
        this.projectService.getNewPlotStream()
            .subscribe(() => this.layoutService.setSidenavContentComponent({component: PlotListComponent}));

        this.handleQueryParameters();
    }

    @HostListener('window:resize')
    private windowHeight() {
        this.windowHeight$.next(window.innerHeight);
    }

    private handleQueryParameters() {
        this.activatedRoute.queryParams.subscribe(p => {
            for (const parameter of Object.keys(p)) {
                const value = p[parameter];
                switch (parameter) {
                    case 'workflow':
                        try {
                            const newLayer = Layer.fromDict(JSON.parse(value));
                            this.projectService.getProjectStream().pipe(first()).subscribe(project => {
                                if (project.layers.length > 0) {
                                    // show popup
                                    this.dialog.open(WorkflowParameterChoiceDialogComponent, {
                                        data: {
                                            dialogTitle: 'Workflow URL Parameter',
                                            sourceName: 'URL parameter',
                                            layers: [newLayer],
                                            nonAvailableNames: [],
                                            numberOfLayersInProject: project.layers.length,
                                        }
                                    });
                                } else {
                                    // just add the layer if the layer array is empty
                                    this.projectService.addLayer(newLayer);
                                }
                            });
                        } catch (error) {
                            this.notificationService.error(`Invalid Workflow: »${error}«`);
                        }
                        break;
                    default:
                        this.notificationService.error(`Unknown URL Parameter »${parameter}«`);
                }
            }
        });
    }

}
