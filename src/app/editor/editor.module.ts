// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSortModule } from '@angular/material/sort';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MonacoEditorModule } from '@materia-ui/ngx-monaco-editor';
import { ResizableModule } from 'angular-resizable-element';
import { DirectoriesModule } from '../directories';
import { FilesModule } from '../files/files.module';
import { CwdToolbarModule } from '../sei-cwd-common/cwd-toolbar';
import { SharedModule } from '../shared/shared.module';
import { EditorComponent } from './component/editor/editor.component';
import { ModuleListComponent } from './component/module-list/module-list.component';
import { ModuleVariablesComponent } from './component/module-variables/module-variables.component';
import { VersionListComponent } from './component/version-list/version-list.component';
import { MatLegacyAutocompleteModule as MatAutocompleteModule } from '@angular/material/legacy-autocomplete';

@NgModule({
    declarations: [
        EditorComponent,
        ModuleListComponent,
        ModuleVariablesComponent,
        VersionListComponent,
    ],
    exports: [EditorComponent, ModuleListComponent, ModuleVariablesComponent],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatCardModule,
        MatDialogModule,
        MatTooltipModule,
        MatExpansionModule,
        MatInputModule,
        MatListModule,
        MatMenuModule,
        MatSelectModule,
        MatSidenavModule,
        MatSortModule,
        MatTableModule,
        MatTabsModule,
        MatToolbarModule,
        MatButtonToggleModule,
        MatDividerModule,
        MonacoEditorModule,
        CwdToolbarModule,
        FilesModule,
        DirectoriesModule,
        ResizableModule,
        SharedModule,
        MatAutocompleteModule,
    ],
    providers: []
})
export class EditorModule {}
