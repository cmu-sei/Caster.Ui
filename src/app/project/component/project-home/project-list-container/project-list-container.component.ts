// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, OnInit, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { Project } from '../../../../generated/caster-api';
import { CurrentUserQuery, UserService } from '../../../../users/state';
import { ProjectQuery, ProjectService } from '../../../state';
import { TopbarView } from './../../../../shared/components/top-bar/topbar.models';
import { TopbarComponent } from '../../../../shared/components/top-bar/topbar.component';
import { ProjectListComponent } from '../project-list/project-list.component';
import { AsyncPipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { map } from 'rxjs/operators';
import { ProjectGroupService } from '../../../../project-groups/project-group.service';
import { ProjectGroupsDialogComponent } from '../../../../project-groups/project-groups-dialog/project-groups-dialog.component';

@Component({
  selector: 'cas-project-container',
  templateUrl: './project-list-container.component.html',
  styleUrls: ['./project-list-container.component.scss'],
  imports: [
    TopbarComponent,
    ProjectListComponent,
    AsyncPipe,
    MatButton,
    MatIcon,
  ],
})
export class ProjectListContainerComponent implements OnInit {
  private projectService = inject(ProjectService);
  private projectQuery = inject(ProjectQuery);
  private authService = inject(ComnAuthService);
  private settingsService = inject(ComnSettingsService);
  private dialog = inject(MatDialog);
  private userService = inject(UserService);
  private currentUserQuery = inject(CurrentUserQuery);
  private projectGroupService = inject(ProjectGroupService);

  /** Whether the user manages a project group, and so has groups to manage here. */
  public managesGroups$: Observable<boolean> =
    this.projectGroupService.groups$.pipe(
      map((groups) => groups.some((x) => x.canManage)),
    );

  public username: string;
  public titleText: string;
  public projects: Observable<Project[]>;
  public isLoading$: Observable<boolean>;
  TopbarView = TopbarView;

  ngOnInit() {
    this.projects = this.projectQuery.selectAll();

    this.projectService.loadProjects(true).pipe(take(1)).subscribe();
    this.projectGroupService
      .load()
      .pipe(take(1))
      .subscribe({ error: () => undefined });

    this.isLoading$ = this.projectQuery.selectLoading();

    // Set the page title from configuration file
    this.titleText = this.settingsService.settings.AppTopBarText;

    this.currentUserQuery.select().subscribe((cu) => {
      this.username = cu.name;
    });
    this.userService.setCurrentUser();
  }

  openProjectGroups(): void {
    this.dialog.open(ProjectGroupsDialogComponent, {
      width: '880px',
      maxWidth: '95vw',
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
