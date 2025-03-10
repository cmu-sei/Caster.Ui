// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  ComnAuthService,
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CurrentUserQuery, UserService } from '../../../users/state';
import { TopbarView } from './../../../shared/components/top-bar/topbar.models';
import { PermissionService } from 'src/app/permissions/permission.service';
import { SystemPermission } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-admin-container',
  templateUrl: './admin-container.component.html',
  styleUrls: ['./admin-container.component.scss'],
})
export class AdminContainerComponent implements OnInit, OnDestroy {
  public username: string;
  public titleText: string;
  public definitionId = '';
  public isSidebarOpen = true;
  public usersText = 'Users';
  public modulesText = 'Modules';
  public workspacesText = 'Workspaces';
  public vlansText = 'VLANs';
  public rolesText = 'Roles';
  public groupsText = 'Groups';
  public projectsText = 'Projects';
  public showStatus = this.projectsText;
  public theme$: Observable<Theme>;
  public topbarColor;
  public topbarTextColor;
  TopbarView = TopbarView;

  public permissions$ = this.permissionService.permissions$;
  readonly SystemPermission = SystemPermission;

  private unsubscribe$ = new Subject();

  constructor(
    private authService: ComnAuthService,
    private settingsService: ComnSettingsService,
    private userService: UserService,
    private currentUserQuery: CurrentUserQuery,
    private routerQuery: RouterQuery,
    private router: Router,
    private permissionService: PermissionService
  ) {
    this.theme$ = this.currentUserQuery.userTheme$;
  }

  ngOnInit() {
    // Set the page title from configuration file
    this.titleText = this.settingsService.settings.AppTopBarText;
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor;
    this.currentUserQuery
      .select()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((cu) => {
        this.username = cu.name;
      });
    this.userService.setCurrentUser();

    this.routerQuery
      .selectQueryParams<string>('section')
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((section) => {
        if (section != null) {
          this.showStatus = section;
        }
      });

    this.permissionService.load().subscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  /**
   * Set the display to Users
   */
  adminGotoUsers(): void {
    this.navigateToSection(this.usersText);
  }

  /**
   * Sets the display to Modules
   */
  adminGotoModules(): void {
    this.navigateToSection(this.modulesText);
  }

  /**
   * Sets the display to Workspaces
   */
  adminGotoWorkspaces(): void {
    this.navigateToSection(this.workspacesText);
  }

  /**
   * Sets the display to VLANs
   */
  adminGotoVlans(): void {
    this.navigateToSection(this.vlansText);
  }

  /**
   * Sets the display to Roles
   */
  adminGotoRoles(): void {
    this.navigateToSection(this.rolesText);
  }

  /**
   * Sets the display to Groups
   */
  adminGotoGroups(): void {
    this.navigateToSection(this.groupsText);
  }

  /**
   * Sets the display to Groups
   */
  adminGotoProjects(): void {
    this.navigateToSection(this.projectsText);
  }

  private navigateToSection(sectionName: string) {
    this.router.navigate([], {
      queryParams: { section: sectionName },
      queryParamsHandling: 'merge',
    });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }
}
