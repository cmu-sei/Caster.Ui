/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PermissionService } from 'src/app/permissions/permission.service';

@Component({
  selector: 'cas-project-memberships-page',
  templateUrl: './project-memberships-page.component.html',
  styleUrls: ['./project-memberships-page.component.scss'],
})
export class ProjectMembershipsPageComponent implements OnInit {
  projectId: string;

  activatedRoute = inject(ActivatedRoute);
  permissionService = inject(PermissionService);

  ngOnInit(): void {
    this.projectId = this.activatedRoute.snapshot.paramMap.get('id');
    this.permissionService.loadProjectPermissions(this.projectId).subscribe();
  }
}
