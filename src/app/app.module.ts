import {APP_INITIALIZER, NgModule} from '@angular/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {BrowserModule} from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http';
import {RouterModule} from '@angular/router';

import {AppComponent} from './app.component';
import {
    Config,
    LayerService,
    LayoutService,
    MappingQueryService,
    MapService,
    NotificationService,
    ProjectService,
    RandomColorService,
    SidenavRef,
    StorageService,
    UserService,
    WaveCoreModule,
} from '@umr-dbs/wave-core';
import {AppConfig} from './app-config.service';
import {EbvSelectorComponent} from './ebv-selector/ebv-selector.component';
import {LegendComponent} from './legend/legend.component';
import {NgxMatSelectSearchModule} from 'ngx-mat-select-search';
import {FormsModule} from '@angular/forms';
import { IndicatorPlotComponent } from './indicator-plot/indicator-plot.component';
import {TimeStepSelectorComponent} from './time-step-selector/time-step-selector.component';
import {CountrySelectorComponent} from './country-selector/country-selector.component';

@NgModule({
    declarations: [
        AppComponent,
        EbvSelectorComponent,
        LegendComponent,
        IndicatorPlotComponent,
        TimeStepSelectorComponent,
        CountrySelectorComponent,
    ],
    imports: [
        BrowserAnimationsModule,
        BrowserModule,
        FormsModule,
        HttpClientModule,
        NgxMatSelectSearchModule,
        RouterModule.forRoot([{path: '**', component: AppComponent}], {useHash: true}),
        WaveCoreModule,
    ],
    providers: [
        {provide: Config, useClass: AppConfig},
        {
            provide: APP_INITIALIZER,
            useFactory: (config: AppConfig) => () => config.load(),
            deps: [Config],
            multi: true,
        },
        LayerService,
        LayoutService,
        MappingQueryService,
        MapService,
        NotificationService,
        ProjectService,
        RandomColorService,
        SidenavRef,
        StorageService,
        UserService,
    ],
    bootstrap: [AppComponent],
})
export class AppModule {
}
