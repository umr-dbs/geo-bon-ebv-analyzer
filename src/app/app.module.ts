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
    StorageService,
    SidenavRef,
    UserService,
    WaveCoreModule,
} from '@umr-dbs/wave-core';
import {AppConfig} from './app-config.service';
import { EbvSelectorComponent } from './ebv-selector/ebv-selector.component';
import { LegendComponent } from './legend/legend.component';

@NgModule({
    declarations: [
        AppComponent,
        EbvSelectorComponent,
        LegendComponent,
    ],
    imports: [
        BrowserAnimationsModule,
        BrowserModule,
        HttpClientModule,
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
