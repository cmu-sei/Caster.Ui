// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { Observable } from 'rxjs';
import {
  Directory,
  TerraformVersionsResult,
  TerraformService,
} from 'src/app/generated/caster-api';
import { DirectoryService, DirectoryQuery } from '../../state';

@Component({
  selector: 'cas-directory-edit-container',
  templateUrl: './directory-edit-container.component.html',
  styleUrls: ['./directory-edit-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryEditContainerComponent implements OnInit {
  @Input() id: string;
  @Output() editDirectoryComplete = new EventEmitter<boolean>();

  public directory$: Observable<Directory>;
  public versionResult$: Observable<TerraformVersionsResult>;
  public maxParallelism$: Observable<number>;

  constructor(
    private directoryService: DirectoryService,
    private directoryQuery: DirectoryQuery,
    private terraformService: TerraformService
  ) {}

  ngOnInit(): void {
    this.directory$ = this.directoryQuery.selectEntity(this.id);
    this.versionResult$ = this.terraformService.getTerraformVersions();
    this.maxParallelism$ = this.terraformService.getTerraformMaxParallelism();
  }

  onUpdateDirectory(directory: Partial<Directory>) {
    if (directory != null) {
      this.directoryService.partialUpdate(this.id, directory);
    }
    this.editDirectoryComplete.emit(true);
  }
}
