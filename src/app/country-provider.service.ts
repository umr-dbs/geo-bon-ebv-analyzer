import {Injectable} from '@angular/core';
import {ReplaySubject} from 'rxjs';
import {COUNTRY_LIST} from './country-selector/country-selector-data.model';

type RawCountryData = [string, number, number, number, number, number];
export interface Country {
  name: string;
  minx: number;
  maxx: number;
  miny: number;
  maxy: number;
  tif_channel_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class CountryProviderService {

  public readonly selectedCountry$: ReplaySubject<Country>;
  public readonly availabeCountries: Array<Country>;

  constructor() {
    this.selectedCountry$ = new ReplaySubject(1);
    this.availabeCountries  = COUNTRY_LIST.map(r => {
      const [name, minx, maxx, miny, maxy, tif_channel_id] = r;
      return {
        name,
        minx,
        maxx,
        miny,
        maxy,
        tif_channel_id
      };
    });
  }

  public setSelectedCountry(country: Country) {
    // TODO: remove debug log
    console.log("CountryProviderService", "set", country);
    this.selectedCountry$.next(country);
  }

  public clearSelectedCountry() {
    this.selectedCountry$.next(undefined);
  }

  public getSelectedCountryStream(): ReplaySubject<Country> {
    // TODO: remove debug log
    console.log("CountryProviderService", "getSelectedCountryStream");
    return this.selectedCountry$;
  }
}
