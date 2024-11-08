import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
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
export class ProjectMembershipListComponent implements OnInit, OnChanges {
  @Input()
  users: User[];

  @Input()
  groups: Group[];

  @Output()
  createMembership = new EventEmitter<CreateProjectMembershipCommand>();

  displayedColumns: string[] = ['name', 'type', 'actions'];
  dataSource = new MatTableDataSource<ProjectMemberModel>();

  constructor(public snackBar: MatSnackBar) {}

  ngOnInit(): void {}

  ngOnChanges() {
    this.dataSource.data = this.buildModel();
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
}

export interface ProjectMemberModel {
  user: User;
  group: Group;
  id: string;
  name: string;
  type: string;
}
