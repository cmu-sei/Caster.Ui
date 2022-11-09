// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';

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
        FlexLayoutModule,
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
