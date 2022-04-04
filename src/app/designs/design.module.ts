/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesignComponent } from './components/design/design.component';
import { EditorModule } from '../editor/editor.module';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { FlexLayoutModule } from '@angular/flex-layout';
import { VariablesComponent } from './components/variables/variables.component';
import { VariableComponent } from './components/variables/variable/variable.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { DesignModulesComponent } from './components/design-modules/design-modules.component';
import { DesignModuleComponent } from './components/design-modules/design-module/design-module.component';
import { ClipboardModule } from 'ngx-clipboard';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ModuleOutputsComponent } from './components/module-outputs/module-outputs.component';
import { ModuleOutputComponent } from './components/module-outputs/module-output/module-output.component';

@NgModule({
  declarations: [
    DesignComponent,
    VariablesComponent,
    VariableComponent,
    DesignModulesComponent,
    DesignModuleComponent,
    ModuleOutputsComponent,
    ModuleOutputComponent,
  ],
  imports: [
    CommonModule,
    EditorModule,
    MatButtonModule,
    MatCardModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatOptionModule,
    MatSelectModule,
    MatExpansionModule,
    ClipboardModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  exports: [DesignComponent],
})
export class DesignModule {}
