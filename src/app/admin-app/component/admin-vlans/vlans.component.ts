import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { ProjectQuery } from 'src/app/project';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';

@Component({
  selector: 'cas-vlans',
  templateUrl: './vlans.component.html',
  styleUrls: ['./vlans.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VlansComponent implements OnInit, OnDestroy {
  public projects$ = this.projectQuery.selectAll();

  constructor(
    private projectQuery: ProjectQuery,
    private signalRService: SignalRService
  ) {}

  ngOnInit(): void {
    this.signalRService
      .startConnection()
      .then(() => {
        this.signalRService.joinVlansAdmin();
      })
      .catch((err) => {
        console.log(err);
      });
  }

  ngOnDestroy() {
    this.signalRService.leaveVlansAdmin();
  }
}
