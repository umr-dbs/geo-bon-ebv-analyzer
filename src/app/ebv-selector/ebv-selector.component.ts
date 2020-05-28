import {Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Config, MappingRequestParameters, UserService} from '@umr-dbs/wave-core';
import {BehaviorSubject} from 'rxjs';

@Component({
    selector: 'wave-ebv-ebv-selector',
    templateUrl: './ebv-selector.component.html',
    styleUrls: ['./ebv-selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EbvSelectorComponent implements OnInit {

    loading$ = new BehaviorSubject(true);

    ebvClasses: Array<string> = undefined;
    ebvClass: string = undefined;
    ebvNames: Array<string> = undefined;
    ebvName: string = undefined;
    ebvDatasets: Array<EbvDataset> = undefined;
    ebvDataset: EbvDataset = undefined;

    constructor(private userService: UserService,
                private config: Config,
                private changeDetectorRef: ChangeDetectorRef,
                private http: HttpClient) {
    }

    ngOnInit() {
        const ebvClassRequest = new MappingRequestParameters({
            service: 'geo_bon_catalog',
            request: 'classes',
            sessionToken: this.userService.getSession().sessionToken,
        });
        this.http.get<EbvClassesResponse>(`${this.config.MAPPING_URL}?${ebvClassRequest.toMessageBody()}`).subscribe(data => {
            this.ebvClasses = data.classes;

            this.changeDetectorRef.markForCheck();
            this.loading$.next(false);
        });
    }

    setEbvClass(ebvClass: string) {
        if (this.ebvClass === ebvClass) {
            return;
        }

        this.ebvClass = ebvClass;

        this.clearAfter('ebvClass');

        this.loading$.next(true);

        const ebvClassRequest = new MappingRequestParameters({
            service: 'geo_bon_catalog',
            request: 'names',
            sessionToken: this.userService.getSession().sessionToken,
        });
        this.http.get<EbvNamesResponse>(`${this.config.MAPPING_URL}?${ebvClassRequest.toMessageBody()}`).subscribe(data => {
            this.ebvNames = data.names;

            this.changeDetectorRef.markForCheck();
            this.loading$.next(false);
        });
    }

    setEbvName(ebvName: string) {
        if (this.ebvName === ebvName) {
            return;
        }

        this.ebvName = ebvName;

        this.clearAfter('ebvName');

        this.loading$.next(true);

        const ebvClassRequest = new MappingRequestParameters({
            service: 'geo_bon_catalog',
            request: 'datasets',
            sessionToken: this.userService.getSession().sessionToken,
        });
        this.http.get<EbvDatasetsResponse>(`${this.config.MAPPING_URL}?${ebvClassRequest.toMessageBody()}`).subscribe(data => {
            this.ebvDatasets = data.datasets;

            this.changeDetectorRef.markForCheck();
            this.loading$.next(false);
        });
    }

    setEbvDataset(ebvDataset: EbvDataset) {
        if (this.ebvDataset === ebvDataset) {
            return;
        }

        this.ebvDataset = ebvDataset;

        // TODO: rest...
    }

    private clearAfter(field: string) {
        switch (field) {
            case 'ebvClass':
                this.ebvNames = undefined;
                this.ebvName = undefined;
            // falls through
            case 'ebvName':
                this.ebvDatasets = undefined;
                this.ebvDataset = undefined;
        }
        // TODO: others...
    }
}

interface EbvClassesResponse {
    result: true;
    classes: Array<string>;
}

interface EbvNamesResponse {
    result: true;
    names: Array<string>;
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
