// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WorkspaceContainerComponent } from './components/workspace-container/workspace-container.component';
import { CwdToolbarModule } from '../sei-cwd-common/cwd-toolbar';
import { NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { OutputComponent} from './components/output/output.component';
import { ClipboardModule } from 'ngx-clipboard';
import { CwdTableModule } from '../sei-cwd-common/cwd-table/cwd-table.module';
import { RunComponent } from './components/run/run.component';
import { WorkspaceEditContainerComponent } from './components/workspace-edit-container/workspace-edit-container.component';
import { WorkspaceEditComponent } from './components/workspace-edit-container/workspace-edit/workspace-edit.component';
import { MatLegacyOptionModule as MatOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
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
    ClipboardModule,
    CwdTableModule,
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
