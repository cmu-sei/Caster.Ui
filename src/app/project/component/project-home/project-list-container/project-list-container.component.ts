// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { ConfirmDialogComponent } from 'src/app/sei-cwd-common/confirm-dialog/components/confirm-dialog.component';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { Project } from '../../../../generated/caster-api';
import { CurrentUserQuery, UserService } from '../../../../users/state';
import { ProjectQuery, ProjectService } from '../../../state';
import { TopbarView } from './../../../../shared/components/top-bar/topbar.models';

@Component({
  selector: 'cas-project-container',
  templateUrl: './project-list-container.component.html',
  styleUrls: ['./project-list-container.component.scss'],
})
export class ProjectListContainerComponent implements OnInit {
  public username: string;
  public titleText: string;
  public topbarColor = '#0FABEA';
  public topbarTextColor;
  public isSuperUser = false;
  public projects: Observable<Project[]>;
  public isLoading$: Observable<boolean>;
  TopbarView = TopbarView;

  constructor(
    private projectService: ProjectService,
    private projectQuery: ProjectQuery,
    private authService: ComnAuthService,
    private settingsService: ComnSettingsService,
    private dialog: MatDialog,
    private userService: UserService,
    private currentUserQuery: CurrentUserQuery
  ) {}

  ngOnInit() {
    this.projects = this.projectQuery.selectAll();

    this.projectService.loadProjects(true).pipe(take(1)).subscribe();

    this.isLoading$ = this.projectQuery.selectLoading();

    // Set the topbar color from config file
    this.topbarColor = this.settingsService.settings.AppTopBarHexColor;
    this.topbarTextColor = this.settingsService.settings.AppTopBarHexTextColor;

    // Set the page title from configuration file
    this.titleText = this.settingsService.settings.AppTopBarText;

    this.currentUserQuery.select().subscribe((cu) => {
      this.isSuperUser = cu.isSuperUser;
      this.username = cu.name;
    });
    this.userService.setCurrentUser();
  }

  logout(): void {
    this.authService.logout();
  }
}
