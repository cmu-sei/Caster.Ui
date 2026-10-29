// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
} from '@angular/core';
import { ProjectObjectType, ProjectService } from 'src/app/project/state';
import { DirectoryService } from 'src/app/directories';
import { FileService } from 'src/app/files/state';
import {
  ArchiveType,
  DiskKind,
  DiskManifest,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import FileDownloadUtils from 'src/app/shared/utilities/file-download-utils';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
} from '@cmusei/crucible-common';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect, MatOption } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'cas-project-export',
  templateUrl: './project-export.component.html',
  styleUrls: ['./project-export.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatTooltip,
    AsyncPipe,
    TitleCasePipe,
  ],
})
export class ProjectExportComponent implements OnInit {
  private directoryService = inject(DirectoryService);
  private projectService = inject(ProjectService);
  private fileService = inject(FileService);
  private formBuilder = inject(UntypedFormBuilder);
  private permissionService = inject(PermissionService);

  readonly id = input<string>(undefined);
  readonly name = input<string>(undefined);
  @Input()
  set type(val: ProjectObjectType) {
    this._type = val;
    this.isArchiveable = val !== ProjectObjectType.FILE;
    this.typeString = val;
  }

  readonly exportComplete = output<boolean>();

  form: UntypedFormGroup;
  isArchiveable: boolean;
  archiveTypes = Object.keys(ArchiveType);
  typeString: string;

  /** A disk manifest describes the hypervisor, so it needs ViewHosts. */
  canIncludeDiskManifest$: Observable<boolean>;
  diskManifest$ = new BehaviorSubject<DiskManifestPreview | null>(null);

  private _type: ProjectObjectType;

  constructor() {
    const formBuilder = this.formBuilder;

    this.form = formBuilder.group({
      archiveType: [this.archiveTypes[0]],
      includeIds: [false, Validators.required],
      includeDiskManifest: [false],
    });
    this.canIncludeDiskManifest$ = this.permissionService.hasPermission(
      SystemPermission.ViewHosts,
    );
  }

  ngOnInit() {}

  export() {
    this.onExport(
      this.id(),
      this._type,
      this.form.value.archiveType,
      this.form.value.includeIds,
      this.isArchiveable && this.form.value.includeDiskManifest,
    );
    this.exportComplete.emit(true);
  }

  /** Previews the manifest the first time it is switched on. */
  onIncludeDiskManifestChange(checked: boolean) {
    if (!checked || this.diskManifest$.value) {
      return;
    }

    this.diskManifest$.next({ loading: true });

    const manifest$ =
      this._type === ProjectObjectType.DIRECTORY
        ? this.directoryService.getDiskManifest(this.id())
        : this.projectService.getDiskManifest(this.id());

    manifest$
      .pipe(take(1))
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe({
        next: (manifest) =>
          this.diskManifest$.next({ loading: false, manifest }),
        error: () => this.diskManifest$.next({ loading: false, failed: true }),
      });
  }

  diskKindLabel(kind: DiskKind): string {
    return diskKindLabel(kind);
  }

  cancel() {
    this.exportComplete.emit(false);
  }

  private onExport(
    id: string,
    type: ProjectObjectType,
    archiveType: ArchiveType,
    includeIds: boolean,
    includeDiskManifest: boolean,
  ) {
    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        this.directoryService
          .export(id, archiveType, includeIds, includeDiskManifest)
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
          .export(id, archiveType, includeIds, includeDiskManifest)
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

interface DiskManifestPreview {
  loading: boolean;
  manifest?: DiskManifest;
  failed?: boolean;
}

export function diskKindLabel(kind: DiskKind): string {
  return kind === DiskKind.Iso ? 'ISO' : 'VM template';
}
