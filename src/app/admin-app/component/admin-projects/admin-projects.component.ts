import { Component, OnInit } from '@angular/core';
import { ProjectQuery, ProjectService } from 'src/app/project';

@Component({
  selector: 'cas-admin-projects',
  templateUrl: './admin-projects.component.html',
  styleUrls: ['./admin-projects.component.scss'],
})
export class AdminProjectsComponent implements OnInit {
  constructor(
    private projectService: ProjectService,
    private projectQuery: ProjectQuery
  ) {}

  public projects$ = this.projectQuery.selectAll();
  public loading$ = this.projectQuery.selectLoading();

  ngOnInit(): void {
    this.projectService.loadProjects(false).subscribe();
  }
}
