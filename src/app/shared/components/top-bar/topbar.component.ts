// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ComnAuthQuery, ComnAuthService, Theme } from '@cmusei/crucible-common';
import { Observable, ReplaySubject, Subject, of } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { CurrentUserQuery } from 'src/app/users/state';
import { UserService } from '../../../users/state/user.service';
import { CurrentUserState } from './../../../users/state/user.store';
import { TopbarView } from './topbar.models';
import { PermissionService } from 'src/app/permissions/permission.service';
import {
  ProjectPermission,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { MatDialog } from '@angular/material/dialog';
import { ProjectGroupService } from 'src/app/project-groups/project-group.service';
import { ProjectGroupsDialogComponent } from 'src/app/project-groups/project-groups-dialog/project-groups-dialog.component';
import { ProjectQuery } from 'src/app/project/state/project-query.service';
import { MatToolbar, MatToolbarRow } from '@angular/material/toolbar';
import { MatIconButton, MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { AsyncPipe } from '@angular/common';
@Component({
  selector: 'cas-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbar,
    MatToolbarRow,
    MatIconButton,
    RouterLink,
    MatIcon,
    MatButton,
    MatMenuTrigger,
    MatMenu,
    MatMenuItem,
    MatSlideToggle,
    AsyncPipe,
  ],
})
export class TopbarComponent implements OnInit, OnDestroy, OnChanges {
  private authService = inject(ComnAuthService);
  private currentUserQuery = inject(CurrentUserQuery);
  private userService = inject(UserService);
  private authQuery = inject(ComnAuthQuery);
  private router = inject(Router);
  private permissionService = inject(PermissionService);
  private projectGroupService = inject(ProjectGroupService);
  private dialog = inject(MatDialog);

  readonly title = input<string>('Caster');
  @Input() sidenav?;
  readonly topbarView = input<TopbarView>(TopbarView.CASTER_HOME);
  @Input() projectId?: string;

  readonly sidenavToggle = output<boolean>();
  readonly editMemberships = output<any>();

  currentUser$: Observable<CurrentUserState>;
  theme$: Observable<Theme>;
  unsubscribe$: Subject<null> = new Subject<null>();
  TopbarView = TopbarView;

  canViewAdmin$ = this.permissionService.canViewAdiminstration();

  canManageProject$: Observable<boolean>;

  /** The user's system permissions once read, so nothing is decided from the empty list before. */
  private readonly loadedPermissions = new ReplaySubject<SystemPermission[]>(1);

  /**
   * Group managers who can't reach Administration's Project Groups manage their groups from the
   * user menu, on every page. Only they need the groups read.
   */
  managesGroupsOutsideAdmin$: Observable<boolean> = this.loadedPermissions.pipe(
    map(
      (x) =>
        x.includes(SystemPermission.ViewProjects) ||
        x.includes(SystemPermission.ManageProjectGroups),
    ),
    distinctUntilChanged(),
    switchMap((inAdmin) =>
      inAdmin
        ? of(false)
        : this.projectGroupService
            .groupsLoaded$()
            .pipe(map((groups) => groups.some((x) => x.canManage))),
    ),
  );

  openProjectGroups(): void {
    this.dialog.open(ProjectGroupsDialogComponent, {
      width: '880px',
      maxWidth: '95vw',
    });
  }

  ngOnInit() {
    this.permissionService
      .load()
      .subscribe((x) => this.loadedPermissions.next(x ?? []));
    this.permissionService.loadGroupPermissions().subscribe();

    this.currentUser$ = this.currentUserQuery.select().pipe(
      filter((user) => user !== null),
      takeUntil(this.unsubscribe$),
    );

    this.theme$ = this.authQuery.userTheme$;
  }

  ngOnChanges() {
    this.canManageProject$ = this.permissionService.canManageProject(
      this.projectId,
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
    this.editMemberships.emit(undefined);
  }

  getEditMembershipsUrl() {}

  logout(): void {
    this.authService.logout();
  }

  exitAdmin(): void {
    this.router.navigate([this.currentUserQuery.getLastRoute()]);
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
