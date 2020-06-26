import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {COUNTRY_LIST} from './country-selector/country-selector-data.model';
import {
    AbstractSymbology,
    DataType,
    DataTypes,
    GdalSourceType,
    Layer, MappingRasterSymbology,
    Operator, Project,
    Projections, ProjectService,
    RasterLayer,
    ResultTypes,
    Unit
} from '@umr-dbs/wave-core';

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

    public readonly selectedCountry$ = new BehaviorSubject<Country>(undefined);
    public readonly availabeCountries: Array<Country>;

    private layer: Layer<AbstractSymbology>;

    constructor(private readonly projectService: ProjectService) {
        this.availabeCountries = COUNTRY_LIST.map(r => {
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

    public replaceLayerOnMap() {
        const country = this.selectedCountry$.value;
        if (!country) {
            return;
        }

        // the gdal source for the country raster
        const countryOperatorType = new GdalSourceType({
            channelConfig: {
                channelNumber: country.tif_channel_id, // map to gdal source logic
                displayValue: country.name,
            },
            sourcename: 'ne_10m_admin_0_countries_as_raster',
            transform: false, // TODO: user selectable transform?
        });

        const countrySourceOperator = new Operator({
            operatorType: countryOperatorType,
            resultType: ResultTypes.RASTER,
            projection: Projections.WGS_84,
            attributes: ['value'],
            dataTypes: new Map<string, DataType>().set('value', DataTypes.Byte),
            units: new Map<string, Unit>().set('value', Unit.defaultUnit),
        });

        // TODO: change to polygon
        const newLayer = new RasterLayer({
            name: country.name,
            operator: countrySourceOperator,
            symbology: MappingRasterSymbology.createSymbology(
                {
                    unit: {min: 0, max: 1, measurement: 'mask', classes: [], interpolation: 1, unit: 'none'}
                }),
        });

        if (this.layer) {
            try {
                this.projectService.removeLayer(this.layer);
            } catch (e) {
                // TODO: rule out that this can fail
            }
        }
        this.projectService.addLayer(newLayer);
        this.layer = newLayer;
    }

    public setSelectedCountry(country: Country) {
        // TODO: remove debug log
        console.log('CountryProviderService', 'set', country);
        this.selectedCountry$.next(country);
        this.replaceLayerOnMap();
    }

    public clearSelectedCountry() {
        this.selectedCountry$.next(undefined);
    }

    public getSelectedCountryStream(): Observable<Country> {
        // TODO: remove debug log
        console.log('CountryProviderService', 'getSelectedCountryStream');
        return this.selectedCountry$;
    }
}
