import {Injectable} from '@angular/core';
import {ReplaySubject, Observable, combineLatest} from 'rxjs';
import {Time} from '@umr-dbs/wave-core';

export interface TimeStep {
  displayValue?: string;
  time: Time;
}

@Injectable({
  providedIn: 'root'
})
export class TimeService {

  public readonly availableTimeSteps: ReplaySubject<Array<TimeStep | undefined>>;
  public readonly timeFormat: ReplaySubject<string>;


  constructor() {
    this.availableTimeSteps = new ReplaySubject(1);
    this.timeFormat = new ReplaySubject(1);
  }

  public setAvailableTimeSteps(timeSteps: Array<TimeStep>) {
    this.availableTimeSteps.next(timeSteps);
  }

  public setTimeFormatFromUnit(timeUnit: string) {
    this.timeFormat.next(TimeService.unitToFormat(timeUnit));
  }

  public clearTimeSteps() {
    this.availableTimeSteps.next(undefined);
  }

  public getAvailableTimeSteps(): ReplaySubject<Array<TimeStep | undefined>> {
    return this.availableTimeSteps;
  }

  public static unitToFormat(unit: string): string {
    let format: string;
    switch (unit.toLowerCase()) {
        case 'year':
        case 'years':
            format = 'YYYY';
            break;
        case 'month':
        case 'months':
            format = 'YYYY-MM';
            break;
        case 'day':
        case 'days':
        default:
            format = 'YYYY-MM-DD';
            break;
    }
    return format;
}

}
