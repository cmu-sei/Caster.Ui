/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  OnDestroy,
} from '@angular/core';
import { SystemPermission } from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
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
  public canEdit$ = this.permissionService.hasPermission(
    SystemPermission.ManageVlans
  );

  constructor(
    private projectQuery: ProjectQuery,
    private signalRService: SignalRService,
    private permissionService: PermissionService
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
