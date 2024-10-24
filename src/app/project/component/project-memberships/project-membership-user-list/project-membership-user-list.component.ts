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
import { User } from 'src/app/generated/caster-api';

@Component({
  selector: 'cas-project-membership-user-list',
  templateUrl: './project-membership-user-list.component.html',
  styleUrls: ['./project-membership-user-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectMembershipUserListComponent implements OnInit, OnChanges {
  @Input()
  users: User[];

  @Output()
  createMembership = new EventEmitter<string>();

  displayedColumns: string[] = ['name', 'actions'];
  dataSource = new MatTableDataSource<User>();

  constructor(public snackBar: MatSnackBar) {}

  ngOnInit(): void {}

  ngOnChanges() {
    this.dataSource.data = this.users;
  }

  addUser(userId: string) {
    this.createMembership.emit(userId);
  }
}
