// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  MatFormField,
  MatLabel,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { ProjectGroup, SystemPermission } from 'src/app/generated/caster-api';
import { apiErrorMessage } from 'src/app/environment-sets/environment-set-rules';
import { PermissionService } from 'src/app/permissions/permission.service';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { ProjectGroupDetailComponent } from '../project-group-detail/project-group-detail.component';
import { ProjectGroupService } from '../project-group.service';

/**
 * The project groups the user can see, searchable, each row expanding to its detail.
 * ManageProjectGroups holders also create, rename and delete them. Used by Administration and by
 * group managers' own dialog.
 */
@Component({
  selector: 'cas-project-groups-list',
  templateUrl: './project-groups-list.component.html',
  styleUrls: ['./project-groups-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatIcon,
    MatTooltip,
    ProjectGroupDetailComponent,
  ],
})
export class ProjectGroupsListComponent implements OnInit {
  private groupService = inject(ProjectGroupService);
  private permissionService = inject(PermissionService);
  private dialog = inject(MatDialog);
  private confirmService = inject(CrucibleDialogService);

  readonly groups$ = this.groupService.groups$;
  private readonly groups = toSignal(this.groups$, { initialValue: [] });
  readonly filter = signal('');
  readonly expandedId = signal<string | null>(null);

  /** The groups whose name or description matches the search. */
  readonly visible = computed(() => {
    const term = this.filter().trim().toLowerCase();
    return this.groups().filter(
      (x) =>
        !term ||
        (x.name ?? '').toLowerCase().includes(term) ||
        (x.description ?? '').toLowerCase().includes(term),
    );
  });

  toggle(group: ProjectGroup): void {
    this.expandedId.update((x) => (x === group.id ? null : group.id));
  }
  readonly canManageGroups$: Observable<boolean> =
    this.permissionService.hasPermission(SystemPermission.ManageProjectGroups);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.groupService
      .load()
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });
  }

  create(): void {
    this.nameDialog('Add Project Group', {
      nameValue: '',
      showDescription: true,
      descriptionValue: '',
    })
      .pipe(
        filter((x) => !!x),
        switchMap((x) =>
          this.groupService.create(x.nameValue, x.descriptionValue),
        ),
      )
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });
  }

  edit(group: ProjectGroup): void {
    this.nameDialog(`Edit ${group.name}`, {
      nameValue: group.name,
      showDescription: true,
      descriptionValue: group.description ?? '',
    })
      .pipe(
        filter((x) => !!x),
        switchMap((x) =>
          this.groupService.edit(group.id, x.nameValue, x.descriptionValue),
        ),
      )
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });
  }

  delete(group: ProjectGroup): void {
    this.confirmService
      .confirm({
        title: 'Delete Project Group',
        message: `Delete ${group.name}? Its ${group.projects?.length ?? 0} projects stay, ungrouped, and lose its memberships, sets and connections.`,
        confirmText: 'Delete',
      })
      .afterClosed()
      .pipe(
        filter((x) => !!x),
        switchMap(() => this.groupService.delete(group.id)),
      )
      .subscribe({ error: (err) => this.error.set(apiErrorMessage(err)) });
  }

  private nameDialog(
    title: string,
    data: unknown,
  ): Observable<{ nameValue: string; descriptionValue: string }> {
    const dialogRef: MatDialogRef<NameDialogComponent> = this.dialog.open(
      NameDialogComponent,
      {
        data,
        minWidth: '400px',
        maxWidth: '90vw',
      },
    );
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = '';
    return dialogRef.afterClosed();
  }
}
