// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  viewChild,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatTableDataSource,
  MatTable,
  MatColumnDef,
  MatHeaderCellDef,
  MatHeaderCell,
  MatCellDef,
  MatCell,
  MatHeaderRowDef,
  MatHeaderRow,
  MatRowDef,
  MatRow,
} from '@angular/material/table';
import { MatIcon } from '@angular/material/icon';
import {
  MatFormField,
  MatLabel,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatTooltip } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Observable, combineLatest } from 'rxjs';
import { filter, map, switchMap, take } from 'rxjs/operators';
import {
  EnvironmentSet,
  EnvironmentSetValueSource,
  SystemPermission,
  TerraformRunMode,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { EnvironmentSetDetailComponent } from './environment-set-detail/environment-set-detail.component';
import { EnvironmentSecretsComponent } from './environment-secrets/environment-secrets.component';
import {
  EnvironmentSetMultiEditDialogComponent,
  EnvironmentSetMultiEditDialogData,
} from './environment-set-multi-edit-dialog/environment-set-multi-edit-dialog.component';
import {
  CreateFromConnectionDialogComponent,
  CreateFromConnectionDialogData,
} from './create-from-connection-dialog/create-from-connection-dialog.component';
import { MatTab, MatTabGroup } from '@angular/material/tabs';

/**
 * Administration > Environment Sets: the sets and their entries, which projects
 * each is assigned to, the secret names the API can supply, and how runs execute.
 */
@Component({
  selector: 'cas-admin-environment-sets',
  templateUrl: './admin-environment-sets.component.html',
  styleUrls: ['./admin-environment-sets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ),
    ]),
  ],
  imports: [
    AsyncPipe,
    FormsModule,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatSuffix,
    MatButton,
    MatIconButton,
    MatCheckbox,
    MatTooltip,
    MatTable,
    MatSort,
    MatSortHeader,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    EnvironmentSetDetailComponent,
    EnvironmentSecretsComponent,
    MatTabGroup,
    MatTab,
  ],
})
export class AdminEnvironmentSetsComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private environmentSetService = inject(EnvironmentSetService);
  private permissionService = inject(PermissionService);
  private signalRService = inject(SignalRService);
  private dialog = inject(MatDialog);
  private confirmService = inject(CrucibleDialogService);

  readonly sort = viewChild(MatSort);
  readonly RunMode = TerraformRunMode;

  filterString = '';
  displayedColumns = [
    'select',
    'actions',
    'name',
    'description',
    'status',
    'projects',
  ];
  /** The sets ticked for a multi-edit, by id. */
  selectedSetIds = new Set<string>();
  dataSource = new MatTableDataSource<EnvironmentSet>();
  expandedSetIds = new Set<string>();
  showNotes = false;

  dataSource$ = this.environmentSetService.sets$.pipe(
    map((sets) => {
      this.dataSource.data = sets;
      return this.dataSource;
    }),
  );

  secrets$ = this.environmentSetService.secrets$;
  sets$ = this.environmentSetService.sets$;

  canEdit$: Observable<boolean> = this.permissionService.hasPermission(
    SystemPermission.ManageEnvironmentSets,
  );

  /** Connection entries also need ManageInfrastructure. */
  canUseConnections$: Observable<boolean> = combineLatest([
    this.canEdit$,
    this.permissionService.hasPermission(SystemPermission.ManageInfrastructure),
  ]).pipe(map(([edit, infrastructure]) => edit && infrastructure));

  connections$ = this.environmentSetService.connections$;

  ngOnInit(): void {
    this.environmentSetService.load().subscribe();
    this.environmentSetService.loadSecrets().subscribe();
    // The connections' fields and presets are only for those who can edit sets.
    this.canEdit$
      .pipe(
        filter((x) => x),
        take(1),
      )
      .subscribe(() =>
        this.environmentSetService.loadConnections().subscribe(),
      );
    this.signalRService
      .startConnection()
      .then(() => this.signalRService.joinEnvironmentSetsAdmin());
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort();
    this.dataSource.filterPredicate = (set, filter) =>
      [
        set.name,
        set.description,
        ...(set.entries ?? []).map((x) => x.targetName),
      ]
        .filter((x) => !!x)
        .some((x) => x.toLowerCase().includes(filter));
  }

  ngOnDestroy(): void {
    this.signalRService.leaveEnvironmentSetsAdmin();
  }

  applyFilter(filterValue: string): void {
    this.filterString = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  clearFilter(): void {
    this.applyFilter('');
  }

  isExpanded(setId: string): boolean {
    return this.expandedSetIds.has(setId);
  }

  toggleExpand(setId: string): void {
    if (!this.expandedSetIds.delete(setId)) {
      this.expandedSetIds.add(setId);
    }
  }

  expandAll(): void {
    this.expandedSetIds = new Set(
      this.dataSource.filteredData.map((x) => x.id),
    );
  }

  collapseAll(): void {
    this.expandedSetIds = new Set();
  }

  projectNames(set: EnvironmentSet): string {
    return (set.projects ?? []).map((x) => x.name).join(', ');
  }

  isSelected(set: EnvironmentSet): boolean {
    return this.selectedSetIds.has(set.id);
  }

  toggleSelected(set: EnvironmentSet, selected: boolean): void {
    if (selected) {
      this.selectedSetIds.add(set.id);
    } else {
      this.selectedSetIds.delete(set.id);
    }
  }

  /** Edits the ticked sets together. */
  editSelected(): void {
    const sets = this.dataSource.data.filter((x) =>
      this.selectedSetIds.has(x.id),
    );

    if (sets.length < 2) {
      return;
    }

    combineLatest([this.secrets$, this.connections$, this.canUseConnections$])
      .pipe(take(1))
      .subscribe(([secrets, connections, canUseConnections]) =>
        this.dialog.open<
          EnvironmentSetMultiEditDialogComponent,
          EnvironmentSetMultiEditDialogData
        >(EnvironmentSetMultiEditDialogComponent, {
          data: { sets, secrets, connections, canUseConnections },
          width: '840px',
          maxWidth: '95vw',
          disableClose: true,
        }),
      );
  }

  /** Copying a set with connection entries needs ManageInfrastructure, as making them does. */
  hasConnectionEntries(set: EnvironmentSet): boolean {
    return (set.entries ?? []).some(
      (x) => x.valueSource === EnvironmentSetValueSource.Connection,
    );
  }

  /** Asks first: the copy is a new set, "<name> (copy)", with the same entries and no projects. */
  copySet(set: EnvironmentSet): void {
    this.confirmService
      .confirm({
        title: 'Copy Environment Set',
        message: `Copy ${set.name}? The copy gets the same entries, but no projects.`,
        confirmText: 'Copy',
      })
      .afterClosed()
      .pipe(
        take(1),
        filter((confirmed) => !!confirmed),
        switchMap(() => this.environmentSetService.copy(set.id, {})),
      )
      .subscribe((copy) => this.expandedSetIds.add(copy.id));
  }

  createFromConnection(): void {
    this.connections$
      .pipe(
        take(1),
        switchMap((connections) =>
          this.dialog
            .open<
              CreateFromConnectionDialogComponent,
              CreateFromConnectionDialogData,
              EnvironmentSet
            >(CreateFromConnectionDialogComponent, {
              data: { connections },
              width: '520px',
              maxWidth: '90vw',
              disableClose: true,
            })
            .afterClosed(),
        ),
      )
      .subscribe((set) => {
        if (set) {
          this.expandedSetIds.add(set.id);
        }
      });
  }

  createSet(): void {
    this.nameDialog('Add Environment Set', {
      nameValue: '',
      showDescription: true,
      descriptionValue: '',
    }).subscribe((result) => {
      if (result) {
        this.environmentSetService
          .create({
            name: result.nameValue,
            description: result.descriptionValue,
          })
          .subscribe((set) => this.expandedSetIds.add(set.id));
      }
    });
  }

  editSet(set: EnvironmentSet): void {
    this.nameDialog(`Edit ${set.name}`, {
      nameValue: set.name,
      showDescription: true,
      descriptionValue: set.description ?? '',
    }).subscribe((result) => {
      if (result) {
        this.environmentSetService
          .edit(set.id, {
            name: result.nameValue,
            description: result.descriptionValue,
          })
          .subscribe();
      }
    });
  }

  deleteSet(set: EnvironmentSet): void {
    const projects = set.projects ?? [];
    const message = projects.length
      ? `Delete ${set.name}? It is assigned to ${projects.length === 1 ? 'this project' : `these ${projects.length} projects`}, which will no longer get its variables on their next runs: ${this.projectNames(set)}.`
      : `Delete ${set.name}? It is not assigned to any project.`;

    this.confirmService
      .confirm({
        title: 'Delete Environment Set',
        message,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.environmentSetService.delete(set.id).subscribe();
        }
      });
  }

  private nameDialog(title: string, data: any): Observable<any> {
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
