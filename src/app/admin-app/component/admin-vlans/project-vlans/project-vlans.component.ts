/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  AfterViewInit,
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  inject,
  input,
  viewChild,
} from '@angular/core';
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
  MatNoDataRow,
} from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  Observable,
  timer,
} from 'rxjs';
import { finalize, map, take } from 'rxjs/operators';
import { Partition } from 'src/app/generated/caster-api';
import { Pool } from 'src/app/generated/caster-api';
import { Project } from 'src/app/generated/caster-api';
import { ProjectService } from 'src/app/project';
import { PartitionQuery } from 'src/app/vlans/state/partition/partition.query';
import { PartitionService } from 'src/app/vlans/state/partition/partition.service';
import { PoolQuery } from 'src/app/vlans/state/pool/pool.query';
import { PoolService } from 'src/app/vlans/state/pool/pool.service';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatSelect, MatOption, MatOptgroup } from '@angular/material/select';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { AsyncPipe, KeyValuePipe } from '@angular/common';

@Component({
  selector: 'cas-project-vlans',
  templateUrl: './project-vlans.component.html',
  styleUrls: ['./project-vlans.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatIcon,
    MatIconButton,
    MatInput,
    MatSuffix,
    MatTooltip,
    MatNoDataRow,
    MatTable,
    MatSort,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatSortHeader,
    MatCellDef,
    MatCell,
    MatFormField,
    MatSelect,
    MatOption,
    MatOptgroup,
    MatProgressBar,
    MatCard,
    MatProgressSpinner,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    AsyncPipe,
    KeyValuePipe,
  ],
})
export class ProjectVlansComponent implements OnInit, AfterViewInit {
  private projectService = inject(ProjectService);
  private poolService = inject(PoolService);
  private partitionService = inject(PartitionService);
  private poolQuery = inject(PoolQuery);
  private partitionQuery = inject(PartitionQuery);

  @Input() set projects(projects: Project[]) {
    this.dataSource.data = projects;
  }

  readonly canEdit = input<boolean>(undefined);
  readonly isLoading = input<boolean>(false);

  dataSource = new MatTableDataSource<Project>();
  partitionOptions$: Observable<Map<Pool, Partition[]>>;

  // #region loading
  private loadingSubject = new BehaviorSubject<Map<string, boolean>>(
    new Map<string, boolean>(),
  );
  public loading$ = this.loadingSubject.asObservable();

  private setLoading(projectId: string, val: boolean) {
    this.loadingSubject.next(
      this.loadingSubject.getValue().set(projectId, val),
    );
  }
  // #endregion

  displayedColumns: string[] = ['name', 'partition'];

  readonly sort = viewChild(MatSort);

  filterString = '';

  constructor() {
    // The Partition column holds a select, so sort it by the assigned
    // partition's name rather than by its id.
    this.dataSource.sortingDataAccessor = (project, column) =>
      column === 'partition'
        ? (this.partitionQuery.getEntity(project.partitionId)?.name ?? '')
        : project[column];
    this.dataSource.filterPredicate = (project, filter) =>
      (project.name ?? '').toLowerCase().includes(filter);
  }

  ngOnInit(): void {
    forkJoin([
      this.projectService.loadProjects(false),
      this.poolService.load(),
      this.partitionService.load(),
    ]).subscribe();

    this.partitionOptions$ = combineLatest([
      this.poolQuery.selectAll(),
      this.partitionQuery.selectAll(),
    ]).pipe(
      map(([pools, partitions]) => {
        const map = new Map<Pool, Partition[]>();

        pools.forEach((x) => {
          let part = partitions.filter((y) => y.poolId == x.id);
          map.set(x, part);
        });

        return map;
      }),
    );
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort();
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  clearFilter() {
    this.applyFilter('');
  }

  updatePartition(projectId: string, partitionId: string) {
    this.setLoading(projectId, true);

    this.projectService
      .assignPartition(projectId, partitionId)
      .pipe(
        take(1),
        finalize(() => {
          // make sure progress bar is shown
          timer(500).subscribe(() => this.setLoading(projectId, false));
        }),
      )
      .subscribe();
  }
}
