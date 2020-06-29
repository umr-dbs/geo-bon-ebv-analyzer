import {Component, OnInit, ChangeDetectionStrategy, Inject, ChangeDetectorRef, OnDestroy} from '@angular/core';
import {TimeService, TimeStep} from '../time-available.service';
import {Observable, Subscription, combineLatest} from 'rxjs';
import {Time, Config, ProjectService} from '@umr-dbs/wave-core';
import {AppConfig} from '../app-config.service';
import {MatSliderChange} from '@angular/material/slider';
import { map } from 'rxjs/operators';

@Component({
  selector: 'wave-ebv-time-step-selector',
  templateUrl: './time-step-selector.component.html',
  styleUrls: ['./time-step-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeStepSelectorComponent implements OnInit, OnDestroy {

  readonly min = 0;
  readonly step = 1;
  readonly tickInterval = 1;

  readonly currentTimestamp: Observable<Time>;
  readonly currentTimeFormatted: Observable<string>;

  public max = 0;

  private avaiableTimeStepsSubscription: Subscription;
  private avalableTimeSteps: Array<TimeStep | undefined>;

  /**
   * Require services by using DI
   */
  constructor(@Inject(Config) private readonly config: AppConfig,
              private readonly projectService: ProjectService,
              private readonly changeDetectorRef: ChangeDetectorRef,
              public readonly timeService: TimeService
  ) {
    this.avaiableTimeStepsSubscription = this.timeService.availableTimeSteps.subscribe(timeSteps => {
      // this way min always stays `0` and step always stays `1`
      this.max = timeSteps.length - 1;
      this.avalableTimeSteps = timeSteps;

      setTimeout(() => this.changeDetectorRef.detectChanges());
    });

    this.currentTimestamp = this.projectService.getTimeStream();

    this.currentTimeFormatted = combineLatest([this.currentTimestamp, this.timeService.timeFormat]).pipe(
      map(([time, format]) => time.getStart().format(format))
    );

  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.avaiableTimeStepsSubscription.unsubscribe();
  }

  /**
   * On a slider event, calculate the timestamp and set the new time for the app layers
   */
  setTime(event: MatSliderChange) {
    if (!this.avalableTimeSteps) {
      return;
    }
    const tick: number = event.value;
    const timeStep = this.avalableTimeSteps[tick];
    this.projectService.setTime(timeStep.time);
  }

  /**
   * Provides a thumb label display string that shows the timestamp to select (upon hovering)
   */
  thumbLabelDisplay(): (value: number) => string {
    return (value: number) => {
      if (!this.avalableTimeSteps) {
        return '';
      }
      const timeStep = this.avalableTimeSteps[value];
      return (timeStep.displayValue) ? timeStep.displayValue : timeStep.time.toString();
    };
  }

}

