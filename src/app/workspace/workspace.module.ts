// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WorkspaceContainerComponent } from './components/workspace-container/workspace-container.component';
import { CwdToolbarModule } from '../sei-cwd-common/cwd-toolbar';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExtendedModule, FlexModule } from '@angular/flex-layout';
import { OutputComponent } from './components/output/output.component';
import { ClipboardModule } from 'ngx-clipboard';
import { CwdTableModule } from '../sei-cwd-common/cwd-table/cwd-table.module';
import { RunComponent } from './components/run/run.component';
import { WorkspaceEditContainerComponent } from './components/workspace-edit-container/workspace-edit-container.component';
import { WorkspaceEditComponent } from './components/workspace-edit-container/workspace-edit/workspace-edit.component';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { WorkspaceVersionComponent } from './components/workspace-version/workspace-version.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ImportResourceComponent } from './components/import-resource/import-resource.component';

@NgModule({
  declarations: [
    WorkspaceContainerComponent,
    OutputComponent,
    RunComponent,
    WorkspaceEditContainerComponent,
    WorkspaceEditComponent,
    WorkspaceVersionComponent,
    ImportResourceComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CwdToolbarModule,
    MatButtonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatTabsModule,
    MatIconModule,
    NgbPopoverModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatToolbarModule,
    MatTooltipModule,
    MatButtonToggleModule,
    FlexModule,
    ClipboardModule,
    CwdTableModule,
    ExtendedModule,
    MatOptionModule,
    MatSelectModule,
    DragDropModule,
  ],
  exports: [
    WorkspaceContainerComponent,
    RunComponent,
    WorkspaceEditContainerComponent,
  ],
})
export class WorkspaceModule {}
