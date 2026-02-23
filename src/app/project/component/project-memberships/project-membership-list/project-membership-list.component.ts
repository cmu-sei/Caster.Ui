/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  CreateProjectMembershipCommand,
  Group,
  User,
} from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-project-membership-list',
  templateUrl: './project-membership-list.component.html',
  styleUrls: ['./project-membership-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectMembershipListComponent
  implements OnInit, OnChanges, AfterViewInit
{
  @Input()
  users: User[];

  @Input()
  groups: Group[];

  @Input()
  canEdit: boolean;

  @Output()
  createMembership = new EventEmitter<CreateProjectMembershipCommand>();

  viewColumns = ['name', 'type'];
  editColumns = ['actions'];
  displayedColumns = this.viewColumns;

  dataSource = new MatTableDataSource<ProjectMemberModel>();

  filterString = '';

  constructor(public snackBar: MatSnackBar) {}

  ngOnInit(): void {}

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnChanges() {
    this.dataSource.data = this.buildModel();

    this.displayedColumns = this.viewColumns.concat(
      this.canEdit ? this.editColumns : []
    );
  }

  add(id: string, type: string) {
    let command = {} as CreateProjectMembershipCommand;

    if (type == 'User') {
      command.userId = id;
    } else if (type == 'Group') {
      command.groupId = id;
    }

    this.createMembership.emit(command);
  }

  buildModel(): ProjectMemberModel[] {
    const projectMemberModels = [] as ProjectMemberModel[];

    this.users.forEach((x) => {
      projectMemberModels.push({
        user: x,
        group: null,
        id: x.id,
        name: x.name,
        type: 'User',
      });
    });

    this.groups.forEach((x) => {
      projectMemberModels.push({
        user: null,
        group: x,
        id: x.id,
        name: x.name,
        type: 'Group',
      });
    });

    return projectMemberModels;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  clearFilter() {
    this.filterString = '';
    this.dataSource.filter = this.filterString;
  }
}

export interface ProjectMemberModel {
  user: User;
  group: Group;
  id: string;
  name: string;
  type: string;
}
