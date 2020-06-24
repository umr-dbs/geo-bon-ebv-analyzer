import {Injectable} from '@angular/core';
import {ReplaySubject} from 'rxjs';
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

  constructor() {
    this.availableTimeSteps = new ReplaySubject(1);
  }

  public setAvailableTimeSteps(timeSteps: Array<TimeStep>) {
    this.availableTimeSteps.next(timeSteps);
  }

  public clearTimeSteps() {
    this.availableTimeSteps.next(undefined);
  }

  public getAvailableTimeSteps(): ReplaySubject<Array<TimeStep | undefined>> {
    return this.availableTimeSteps;
  }

}
