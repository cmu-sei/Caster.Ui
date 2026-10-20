// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  Input,
  ChangeDetectionStrategy,
  Output,
  EventEmitter,
  inject,
  input,
} from '@angular/core';
import { ProjectObjectType, ProjectService } from 'src/app/project/state';
import { DirectoryService } from 'src/app/directories';
import {
  ArchiveType,
  ImportDirectoryResult,
  ImportProjectResult,
} from 'src/app/generated/caster-api';
import { tap } from 'rxjs/operators';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CrucibleDialogComponent,
  CrucibleDialogContentDirective,
  CrucibleDialogActionsDirective,
} from '@cmusei/crucible-common';
import { MatButton } from '@angular/material/button';
import { MatLabel } from '@angular/material/form-field';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { AsyncPipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'cas-project-import',
  templateUrl: './project-import.component.html',
  styleUrls: ['./project-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CrucibleDialogComponent,
    CrucibleDialogContentDirective,
    FormsModule,
    ReactiveFormsModule,
    MatButton,
    MatLabel,
    MatSlideToggle,
    MatTooltip,
    CrucibleDialogActionsDirective,
    AsyncPipe,
    TitleCasePipe,
  ],
})
export class ProjectImportComponent implements OnInit {
  private directoryService = inject(DirectoryService);
  private projectService = inject(ProjectService);

  readonly id = input<string>(undefined);
  readonly name = input<string>(undefined);
  @Input()
  set type(val: ProjectObjectType) {
    this._type = val;
    this.typeString = val;
  }

  @Output() importComplete = new EventEmitter<boolean>();

  form: UntypedFormGroup;
  archiveTypes = Object.keys(ArchiveType);
  typeString: string;
  lockedFiles = new Array<string>();
  complete = new BehaviorSubject<boolean>(false);
  complete$ = this.complete.asObservable();

  onFileSelected(event: any): void {
    this.form.patchValue({ archive: event.target.files[0] ?? null });
  }

  private _type: ProjectObjectType;

  constructor() {
    const formBuilder = inject(UntypedFormBuilder);

    this.form = formBuilder.group({
      archive: [null, Validators.required],
      preserveIds: [false, Validators.required],
    });
  }

  ngOnInit() {}

  import() {
    this.onImport(
      this.id(),
      this._type,
      this.form.value.archive,
      this.form.value.preserveIds,
    );
  }

  cancel() {
    this.importComplete.emit(false);
  }

  private onImport(
    id: string,
    type: ProjectObjectType,
    archive: Blob,
    preserveIds: boolean,
  ) {
    let obs: Observable<ImportProjectResult | ImportDirectoryResult>;

    switch (type) {
      case ProjectObjectType.DIRECTORY: {
        obs = this.directoryService.import(id, preserveIds, archive);
        break;
      }
      case ProjectObjectType.PROJECT: {
        obs = this.projectService.import(id, preserveIds, archive);
        break;
      }
    }

    if (obs != null) {
      obs = obs.pipe(
        tap((x) => {
          this.lockedFiles = x.lockedFiles;
          this.complete.next(true);
        }),
      );

      obs.subscribe();
    }
  }
}
