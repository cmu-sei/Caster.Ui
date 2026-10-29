// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { Component, OnInit, inject, signal } from '@angular/core';
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

@Component({
  selector: 'cas-project-container',
  templateUrl: './project-list-container.component.html',
  styleUrls: ['./project-list-container.component.scss'],
  imports: [TopbarComponent, ProjectListComponent, AsyncPipe],
})
export class ProjectListContainerComponent implements OnInit {
  private projectService = inject(ProjectService);
  private projectQuery = inject(ProjectQuery);
  private authService = inject(ComnAuthService);
  private settingsService = inject(ComnSettingsService);
  private dialog = inject(MatDialog);
  private userService = inject(UserService);
  private currentUserQuery = inject(CurrentUserQuery);

  public username: string;
  public titleText: string;
  public projects: Observable<Project[]>;
  public isLoading$: Observable<boolean>;
  TopbarView = TopbarView;
  readonly backgroundImage = signal<string | null>(null);

  ngOnInit() {
    this.projects = this.projectQuery.selectAll();

    this.projectService.loadProjects(true).pipe(take(1)).subscribe();

    this.isLoading$ = this.projectQuery.selectLoading();

    // Set the page title from configuration file
    this.titleText = this.settingsService.settings.AppTopBarText;

    // An optional image URL from settings, so a site can brand the page
    // without shipping the image in this repo. Applied only once the image
    // loads, so a missing image leaves the normal page background.
    const background = this.settingsService.settings.AppLandingBackgroundImage;
    if (background) {
      const image = new Image();
      image.onload = () => this.backgroundImage.set(`url("${background}")`);
      image.src = background;
    }

    this.currentUserQuery.select().subscribe((cu) => {
      this.username = cu.name;
    });
    this.userService.setCurrentUser();
  }

  logout(): void {
    this.authService.logout();
  }
}
