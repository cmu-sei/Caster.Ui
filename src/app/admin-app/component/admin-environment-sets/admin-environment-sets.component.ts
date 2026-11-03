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
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  EnvironmentSet,
  SystemPermission,
  TerraformRunMode,
} from 'src/app/generated/caster-api';
import { EnvironmentSetService } from 'src/app/environment-sets/environment-set.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { EnvironmentSetDetailComponent } from './environment-set-detail/environment-set-detail.component';
import { EnvironmentSecretsComponent } from './environment-secrets/environment-secrets.component';
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
    MatIconButton,
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
  displayedColumns = ['actions', 'name', 'description', 'status', 'projects'];
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

  ngOnInit(): void {
    this.environmentSetService.load().subscribe();
    this.environmentSetService.loadSecrets().subscribe();
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
