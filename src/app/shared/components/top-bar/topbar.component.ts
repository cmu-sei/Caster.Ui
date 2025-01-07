// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  ComnAuthQuery,
  ComnAuthService,
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import { Observable, Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { CurrentUserQuery } from 'src/app/users/state';
import { UserService } from '../../../users/state/user.service';
import { CurrentUserState } from './../../../users/state/user.store';
import { TopbarView } from './topbar.models';
import { PermissionService } from 'src/app/permissions/permission.service';
import { ProjectPermission } from 'src/app/generated/caster-api';
import { ProjectQuery } from 'src/app/project';
@Component({
  selector: 'cas-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent implements OnInit, OnDestroy, OnChanges {
  @Input() title?: string = 'Caster';
  @Input() sidenav?;
  @Input() topbarColor?;
  @Input() topbarTextColor?;
  @Input() topbarView?: TopbarView = TopbarView.CASTER_HOME;
  @Input() projectId?: string;

  @Output() sidenavToggle?: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() editMemberships?: EventEmitter<any> = new EventEmitter<any>();

  currentUser$: Observable<CurrentUserState>;
  theme$: Observable<Theme>;
  unsubscribe$: Subject<null> = new Subject<null>();
  TopbarView = TopbarView;

  constructor(
    private authService: ComnAuthService,
    private currentUserQuery: CurrentUserQuery,
    private userService: UserService,
    private authQuery: ComnAuthQuery,
    private router: Router,
    private settingsService: ComnSettingsService,
    private permissionService: PermissionService
  ) {}

  canViewAdmin$ = this.permissionService.canViewAdiminstration();

  canManageProject$: Observable<boolean>;

  ngOnInit() {
    this.permissionService.load().subscribe();

    this.currentUser$ = this.currentUserQuery.select().pipe(
      filter((user) => user !== null),
      takeUntil(this.unsubscribe$)
    );

    this.theme$ = this.authQuery.userTheme$;

    if (!this.topbarColor) {
      this.topbarColor = this.settingsService.settings.AppTopBarHexColor;
    }

    if (!this.topbarTextColor) {
      this.topbarTextColor =
        this.settingsService.settings.AppTopBarHexTextColor;
    }
  }

  ngOnChanges() {
    this.canManageProject$ = this.permissionService.canManageProject(
      this.projectId
    );
  }

  themeFn(event) {
    const theme = event.checked ? Theme.DARK : Theme.LIGHT;
    this.authService.setUserTheme(theme);
    this.userService.setUserTheme(theme);
  }

  sidenavToggleFn() {
    this.sidenavToggle.emit(!this.sidenav.opened);
  }

  editMembershipsFn(event) {
    event.preventDefault();
    this.editMemberships.emit();
  }

  getEditMembershipsUrl() {}

  logout(): void {
    this.authService.logout();
  }

  exitAdmin(): void {
    this.router.navigate([this.currentUserQuery.getLastRoute()]);
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
