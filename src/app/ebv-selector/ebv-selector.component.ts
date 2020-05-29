import {Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Config, MappingRequestParameters, ParametersType, UserService} from '@umr-dbs/wave-core';
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
        this.request<EbvClassesResponse>('classes', undefined, data => {
            this.ebvClasses = data.classes;
        });
    }

    setEbvClass(ebvClass: string) {
        if (this.ebvClass === ebvClass) {
            return;
        }

        this.ebvClass = ebvClass;

        this.clearAfter('ebvClass');

        // TODO: incorporate `ebvClass` variable
        this.request<EbvNamesResponse>('names', undefined, data => {
            this.ebvNames = data.names;
        });
    }

    setEbvName(ebvName: string) {
        if (this.ebvName === ebvName) {
            return;
        }

        this.ebvName = ebvName;

        this.clearAfter('ebvName');

        // TODO: incorporate `ebvName` variable
        this.request<EbvDatasetsResponse>('datasets', undefined, data => {
            this.ebvDatasets = data.datasets;
        });
    }

    setEbvDataset(ebvDataset: EbvDataset) {
        if (this.ebvDataset === ebvDataset) {
            return;
        }

        this.ebvDataset = ebvDataset;

        // TODO: rest...
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
