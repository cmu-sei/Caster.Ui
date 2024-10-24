import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'cas-project-memberships-page',
  templateUrl: './project-memberships-page.component.html',
  styleUrls: ['./project-memberships-page.component.scss'],
})
export class ProjectMembershipsPageComponent implements OnInit {
  projectId: string;

  constructor(private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.projectId = this.activatedRoute.snapshot.paramMap.get('id');
  }
}
