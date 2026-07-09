/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  AfterViewInit,
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatPaginator } from '@angular/material/paginator';
import { MatSelectChange } from '@angular/material/select';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import {
  GroupMembership,
  GroupMembershipRole,
  User,
} from 'src/app/generated/caster-api';
import { filter, tap } from 'rxjs/operators';
import { CurrentUserQuery } from 'src/app/users/state';

@Component({
    selector: 'cas-admin-groups-member-list',
    templateUrl: './admin-groups-member-list.component.html',
    styleUrls: ['./admin-groups-member-list.component.scss'],
    standalone: false
})
export class AdminGroupsMemberListComponent
  implements OnInit, OnChanges, AfterViewInit
{
  @Input()
  memberships: GroupMembership[];

  @Input()
  users: User[];

  @Input()
  canEdit: boolean;

  @Output()
  deleteMembership = new EventEmitter<{ id: string; isCurrentUser: boolean }>();

  @Output()
  changeRole = new EventEmitter<{
    id: string;
    role: GroupMembershipRole;
    isCurrentUser: boolean;
  }>();

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  groupMembershipRoles = Object.values(GroupMembershipRole);

  viewColumns = ['name', 'role'];
  editColumns = ['actions'];
  displayedColumns = this.viewColumns;
  dataSource = new MatTableDataSource<GroupMembershipModel>();

  filterString = '';

  private readonly currentUserQuery = inject(CurrentUserQuery);
  private readonly confirmService = inject(CrucibleDialogService);

  // Read reactively: the current user's id is populated asynchronously once auth
  // resolves, so a synchronous snapshot at construction time can be empty.
  private currentUserId = toSignal(
    this.currentUserQuery.select((s) => s.id),
    { initialValue: '' }
  );

  ngOnInit(): void {}

  isCurrentUser(model: GroupMembershipModel): boolean {
    return model.membership.userId === this.currentUserId();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnChanges() {
    this.buildModel();
    this.displayedColumns = this.viewColumns.concat(
      this.canEdit ? this.editColumns : []
    );
  }

  buildModel() {
    this.dataSource.data = this.memberships
      .map((x) => {
        const user = this.users.find((u) => u.id == x.userId);

        return {
          membership: x,
          user: user,
          name: user?.name,
          role: x.role,
        } as GroupMembershipModel;
      })
      .filter((x) => x);
  }

  delete(model: GroupMembershipModel) {
    const isCurrentUser = this.isCurrentUser(model);

    if (isCurrentUser) {
      // Removing yourself costs you management of this group; confirm first.
      this.confirmService
        .confirm({
          title: 'Remove yourself from this group?',
          message:
            'You are about to remove yourself from this group and may lose access to manage it.',
          confirmText: 'Remove',
        })
        .afterClosed()
        .pipe(
          filter((confirmed) => confirmed === true),
          tap(() => {
            this.deleteMembership.emit({
              id: model.membership.id,
              isCurrentUser,
            });
          })
        )
        .subscribe();
      return;
    }

    this.deleteMembership.emit({ id: model.membership.id, isCurrentUser });
  }

  onRoleChange(model: GroupMembershipModel, event: MatSelectChange) {
    const role = event.value as GroupMembershipRole;
    const isCurrentUser = this.isCurrentUser(model);

    // Warn before demoting yourself out of the Manager role — you would lose
    // the ability to manage this group.
    if (isCurrentUser && role !== GroupMembershipRole.Manager) {
      this.confirmService
        .confirm({
          title: 'Change your own role?',
          message:
            'Changing your role from Manager means you will no longer be able to manage this group.',
          confirmText: 'Change Role',
        })
        .afterClosed()
        .pipe(
          tap((confirmed) => {
            if (confirmed === true) {
              this.changeRole.emit({
                id: model.membership.id,
                role,
                isCurrentUser,
              });
              return;
            }

            // Revert the select back to the current (Manager) value.
            event.source.value = model.membership.role;
          })
        )
        .subscribe();
      return;
    }

    this.changeRole.emit({ id: model.membership.id, role, isCurrentUser });
  }

  trackById(index: number, item: any) {
    return item.id;
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

export interface GroupMembershipModel {
  membership: GroupMembership;
  user: User;
  name: string;
  role: GroupMembershipRole;
}
