// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { FileVersion } from '../../../generated/caster-api';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FileVersionQuery } from 'src/app/fileVersions/state';

@Component({
  selector: 'cas-version-list',
  templateUrl: './version-list.component.html',
  styleUrls: ['./version-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VersionListComponent implements OnInit, OnDestroy {
  @Input() fileId: string;
  @Input() selectedVersionId: string;
  @Output() getVersion: EventEmitter<{ id: string }> = new EventEmitter();
  @Output() revertToVersion: EventEmitter<{
    fileVersion: FileVersion;
  }> = new EventEmitter();
  public versions: FileVersion[];
  public dataSource = new MatTableDataSource();
  public filterString = '';
  private unsubscribe$ = new Subject();

  constructor(
    private fileVersionQuery: FileVersionQuery,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fileVersionQuery
      .selectAll()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((versions) => {
        if (this.fileId) {
          const fileVersions = versions.filter((v) => {
            return v.fileId === this.fileId;
          });
          this.dataSource.data = fileVersions;
          this.dataSource.data.sort((a: any, b: any) => {
            if (a.dateSaved < b.dateSaved) {
              return 1;
            } else if (a.dateSaved > b.dateSaved) {
              return -1;
            } else {
              return 0;
            }
          });
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  applyFilter(filterValue: string) {
    this.filterString = filterValue;
    filterValue = filterValue.trim(); // Remove whitespace
    filterValue = filterValue.toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.dataSource.filter = filterValue;
  }

  clearFilter() {
    this.applyFilter('');
  }

  selectVersionFn(version: FileVersion) {
    this.getVersion.emit({ id: version.id });
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
  }

  revertFile(version: FileVersion) {
    this.revertToVersion.emit({ fileVersion: version });
  }
}
