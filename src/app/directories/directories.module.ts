// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { FlexLayoutModule } from '@angular/flex-layout';
import { CwdToolbarModule } from '../sei-cwd-common/cwd-toolbar';
import { FilesModule } from '../files/files.module';
import { DirectoryEditComponent } from './components/directory-edit-container/directory-edit/directory-edit.component';
import { DirectoryEditContainerComponent } from './components/directory-edit-container/directory-edit-container.component';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';

@NgModule({
  declarations: [DirectoryEditComponent, DirectoryEditContainerComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    FlexLayoutModule,
    CwdToolbarModule,
    FilesModule,
    MatSelectModule,
    MatOptionModule,
    MatCheckboxModule,
  ],
  exports: [DirectoryEditContainerComponent],
})
export class DirectoriesModule {}
