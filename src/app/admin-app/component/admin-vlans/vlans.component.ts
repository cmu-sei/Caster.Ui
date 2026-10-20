/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  OnDestroy,
  inject,
} from '@angular/core';
import { SystemPermission } from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import { ProjectQuery } from 'src/app/project';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { MatTabGroup, MatTab, MatTabContent } from '@angular/material/tabs';
import { PoolsComponent } from './pools/pools.component';
import { ProjectVlansComponent } from './project-vlans/project-vlans.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-vlans',
  templateUrl: './vlans.component.html',
  styleUrls: ['./vlans.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTabGroup,
    MatTab,
    MatTabContent,
    PoolsComponent,
    ProjectVlansComponent,
    AsyncPipe,
  ],
})
export class VlansComponent implements OnInit, OnDestroy {
  private projectQuery = inject(ProjectQuery);
  private signalRService = inject(SignalRService);
  private permissionService = inject(PermissionService);

  public projects$ = this.projectQuery.selectAll();
  public canEdit$ = this.permissionService.hasPermission(
    SystemPermission.ManageVlans,
  );

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
