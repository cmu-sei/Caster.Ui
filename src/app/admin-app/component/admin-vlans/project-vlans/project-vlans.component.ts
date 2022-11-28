/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
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

@Component({
  selector: 'cas-project-vlans',
  templateUrl: './project-vlans.component.html',
  styleUrls: ['./project-vlans.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectVlansComponent implements OnInit {
  @Input() set projects(projects: Project[]) {
    this.dataSource.data = projects;
  }

  dataSource = new MatTableDataSource<Project>();
  partitionOptions$: Observable<Map<Pool, Partition[]>>;

  // #region loading
  private loadingSubject = new BehaviorSubject<Map<string, boolean>>(
    new Map<string, boolean>()
  );
  public loading$ = this.loadingSubject.asObservable();

  private setLoading(projectId: string, val: boolean) {
    this.loadingSubject.next(
      this.loadingSubject.getValue().set(projectId, val)
    );
  }
  // #endregion

  displayedColumns: string[] = ['name', 'partition'];

  constructor(
    private projectService: ProjectService,
    private poolService: PoolService,
    private partitionService: PartitionService,
    private poolQuery: PoolQuery,
    private partitionQuery: PartitionQuery
  ) {}

  ngOnInit(): void {
    forkJoin([
      this.projectService.loadProjects(),
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
      })
    );
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
        })
      )
      .subscribe();
  }
}
