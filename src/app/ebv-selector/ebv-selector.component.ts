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

    ebvClasses: Array<EbvClass> = undefined;
    ebvClass: EbvClass = undefined;
    ebvNames: Array<string> = undefined;
    ebvName: string = undefined;
    ebvDatasets: Array<EbvDataset> = undefined;
    ebvDataset: EbvDataset = undefined;
    ebvSubgroups: Array<EbvSubgroup> = undefined;
    ebvSubgroupValueOptions: Array<Array<EbvSubgroupValue>> = [];
    ebvSubgroupValues: Array<EbvSubgroupValue> = [];

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

    setEbvClass(ebvClass: EbvClass) {
        if (this.ebvClass === ebvClass) {
            return;
        }

        this.ebvClass = ebvClass;

        this.clearAfter('ebvClass');

        this.ebvNames = ebvClass.ebv_names;
    }

    setEbvName(ebvName: string) {
        if (this.ebvName === ebvName) {
            return;
        }

        this.ebvName = ebvName;

        this.clearAfter('ebvName');

        this.request<EbvDatasetsResponse>('datasets', {ebv_name: ebvName}, data => {
            this.ebvDatasets = data.datasets;
        });
    }

    setEbvDataset(ebvDataset: EbvDataset) {
        if (this.ebvDataset === ebvDataset) {
            return;
        }

        this.ebvDataset = ebvDataset;

        this.clearAfter('ebvDataset');

        // TODO: use `ebvDataset.dataset_path`
        const ebv_path = '/home/beilschmidt/CLionProjects/mapping-ebv/test/data/cSAR_idiv_004.nc&service=geo_bon_catalog';
        this.request<EbvSubgroupsResponse>('subgroups', {ebv_path}, data => {
            this.request<EbvSubgroupValuesResponse>('subgroup_values', {
                ebv_path,
                ebv_subgroup: data.subgroups[0].name,
                ebv_group_path: '',
            }, value_data => {
                this.ebvSubgroups = data.subgroups;
                this.ebvSubgroupValueOptions = [value_data.values];
            });
        });
    }

    setEbvSubgroupValue(subgroupIndex: number, subgroupValue: EbvSubgroupValue) {
        this.ebvSubgroupValues[subgroupIndex] = subgroupValue;

        if (subgroupIndex === this.ebvSubgroups.length - 1) { // entity is selected
            // TODO: query time array

            return;
        }

        this.clearAfter('', subgroupIndex);

        // TODO: use `ebvDataset.dataset_path`
        const ebv_path = '/home/beilschmidt/CLionProjects/mapping-ebv/test/data/cSAR_idiv_004.nc&service=geo_bon_catalog';

        this.request<EbvSubgroupValuesResponse>('subgroup_values', {
            ebv_path,
            ebv_subgroup: this.ebvSubgroups[subgroupIndex + 1].name,
            ebv_group_path: this.ebvSubgroupValues.map(value => value.name).join('/'),
        }, value_data => {
            this.ebvSubgroupValueOptions.push(value_data.values);
        });
    }

    isAddButtonVisible(): boolean {
        if (!this.ebvSubgroups || !this.ebvSubgroupValues) {
            return false;
        }
        return this.ebvSubgroups.length === this.ebvSubgroupValues.length; // all groups have a selected value
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

    private clearAfter(field: string, subgroupIndex?: number) {
        switch (field) {
            case 'ebvClass':
                this.ebvNames = undefined;
                this.ebvName = undefined;
            // falls through
            case 'ebvName':
                this.ebvDatasets = undefined;
                this.ebvDataset = undefined;
            // falls through
            case 'ebvDataset':
                this.ebvSubgroups = undefined;
                this.ebvSubgroupValues.length = 0;
                this.ebvSubgroupValueOptions.length = 0;
                break;
            default: // subgroup
                if (subgroupIndex !== undefined) {
                    this.ebvSubgroupValues.length = subgroupIndex + 1;
                    this.ebvSubgroupValueOptions.length = subgroupIndex + 1;
                }
        }
    }
}

interface EbvClass {
    name: string;
    ebv_names: Array<string>;
}

interface EbvClassesResponse {
    result: true;
    classes: Array<EbvClass>;
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

interface EbvSubgroup {
    name: string;
    description: string;
}

interface EbvSubgroupsResponse {
    result: true;
    subgroups: Array<EbvSubgroup>;
}

interface EbvSubgroupValue {
    name: string;
    label: string;
    description: string;
}

interface EbvSubgroupValuesResponse {
    result: true;
    values: Array<EbvSubgroupValue>;
}
