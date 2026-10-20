/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, OnInit } from '@angular/core';
import { ProjectQuery, ProjectService } from 'src/app/project';
import { ProjectListComponent } from '../../../project/component/project-home/project-list/project-list.component';
import { ProjectMembershipsComponent } from '../../../project/component/project-memberships/project-memberships/project-memberships.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'cas-admin-projects',
  templateUrl: './admin-projects.component.html',
  styleUrls: ['./admin-projects.component.scss'],
  imports: [ProjectListComponent, ProjectMembershipsComponent, AsyncPipe],
})
export class AdminProjectsComponent implements OnInit {
  constructor(
    private projectService: ProjectService,
    private projectQuery: ProjectQuery,
  ) {}

  public projects$ = this.projectQuery.selectAll();
  public loading$ = this.projectQuery.selectLoading();
  public selectedProjectId: string;

  ngOnInit(): void {
    this.projectService.loadProjects(false).subscribe();
  }
}
