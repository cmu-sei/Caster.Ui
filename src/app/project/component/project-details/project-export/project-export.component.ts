// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
} from '@angular/core';
import { ProjectObjectType, ProjectService } from 'src/app/project/state';
import { DirectoryService } from 'src/app/directories';
import { FileService } from 'src/app/files/state';
import { ArchiveType } from 'src/app/generated/caster-api';
import { take } from 'rxjs/operators';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import FileDownloadUtils from 'src/app/shared/utilities/file-download-utils';

@Component({
  selector: 'cas-project-export',
  templateUrl: './project-export.component.html',
  styleUrls: ['./project-export.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectExportComponent implements OnInit {
  @Input() id: string;
  @Input() name: string;
  @Input()
  set type(val: ProjectObjectType) {
    this._type = val;
    this.isArchiveable = val !== ProjectObjectType.FILE;
    this.typeString = val;
  }

  @Output() exportComplete = new EventEmitter<boolean>();

  form: FormGroup;
  isArchiveable: boolean;
  archiveTypes = Object.keys(ArchiveType);
  typeString: string;

  private _type: ProjectObjectType;

  constructor(
    private directoryService: DirectoryService,
    private projectService: ProjectService,
    private fileService: FileService,
    private formBuilder: FormBuilder
  ) {
    this.form = formBuilder.group({
      archiveType: [this.archiveTypes[0]],
      includeIds: [true, Validators.required],
    });
  }

  ngOnInit() {}

  export() {
    this.onExport(
      this.id,
      this._type,
      this.form.value.archiveType,
      this.form.value.includeIds
    );
    this.exportComplete.emit(true);
  }

  cancel() {
    this.exportComplete.emit(false);
  }

  private onExport(
    id: string,
    type: ProjectObjectType,
    archiveType: ArchiveType,
    includeIds: boolean
  ) {
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        this.directoryService
          .export(id, archiveType, includeIds)
          .pipe(take(1))
          // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
          .subscribe((result) => {
            FileDownloadUtils.downloadFile(result.blob, result.filename);
          });
        break;
      }
      case ProjectObjectType.FILE: {
        this.fileService
          .export(id)
          .pipe(take(1))
          // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
          .subscribe((result) => {
            FileDownloadUtils.downloadFile(result.blob, result.filename);
          });
        break;
      }
      case ProjectObjectType.PROJECT: {
        this.projectService
          .export(id, archiveType, includeIds)
          .pipe(take(1))
          // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
          .subscribe((result) => {
            FileDownloadUtils.downloadFile(result.blob, result.filename);
          });
        break;
      }
    }
  }
}
