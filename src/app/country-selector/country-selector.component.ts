import {Component, OnInit, ChangeDetectionStrategy, ViewChild, AfterViewInit, OnDestroy, Output, EventEmitter} from '@angular/core';
import {FormControl} from '@angular/forms';
import {ReplaySubject, Subject} from 'rxjs';
import {MatSelect} from '@angular/material/select';
import {takeUntil, take} from 'rxjs/operators';
import {CountryProviderService, Country} from '../country-provider.service';


@Component({
    selector: 'wave-ebv-country-selector',
    templateUrl: './country-selector.component.html',
    styleUrls: ['./country-selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CountrySelectorComponent implements OnInit, AfterViewInit, OnDestroy {

    public readonly countryDataList: Array<Country>;

    public countryCtrl: FormControl = new FormControl();

    public countryFilterCtrl: FormControl = new FormControl();

    public filteredCountries: ReplaySubject<Array<Country>> = new ReplaySubject<Array<Country>>(1);

    @ViewChild('countrySelect', {static: true}) countrySelect: MatSelect;

    protected _onDestroy = new Subject<void>();

    constructor(private readonly countryProviderService: CountryProviderService) {
        this.countryDataList = this.countryProviderService.availabeCountries;
    }

    ngOnInit() {
        // TODO: handle subscriptions properly

        this.countryCtrl.valueChanges
            .pipe(takeUntil(this._onDestroy))
            .subscribe(value => {
                this.countryProviderService.setSelectedCountry(value);
            });

        this.countryProviderService.getSelectedCountryStream().pipe(
            takeUntil(this._onDestroy)
        )
            .subscribe(country => {
                this.countryCtrl.setValue(country, {emitEvent: false, emitModelToViewChange: true});
            });

        this.filteredCountries.next(this.countryDataList.slice());

        this.countryFilterCtrl.valueChanges
            .pipe(takeUntil(this._onDestroy))
            .subscribe(() => {
                this.filterCountries();
            });
    }

    ngAfterViewInit() {
        this.setInitialValue();
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    protected setInitialValue() {
        this.filteredCountries
            .pipe(take(1), takeUntil(this._onDestroy))
            .subscribe(() => {
                this.countrySelect.compareWith = (a: Country, b: Country) => a && b && a.name === b.name;
            });
    }

    protected filterCountries() {
        if (!this.countryDataList) {
            return;
        }
        // get the search keyword
        let search = this.countryFilterCtrl.value;
        if (!search) {
            this.filteredCountries.next(this.countryDataList.slice());
            return;
        } else {
            search = search.toLowerCase();
        }
        this.filteredCountries.next(
            this.countryDataList.filter((country) => country.name.toLowerCase().indexOf(search) > -1)
        );
    }

}
