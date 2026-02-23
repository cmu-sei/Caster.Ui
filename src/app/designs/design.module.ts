/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesignComponent } from './components/design/design.component';
import { EditorModule } from '../editor/editor.module';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { VariablesComponent} from './components/variables/variables.component';
import { VariableComponent } from './components/variables/variable/variable.component';
import { ReactiveFormsModule } from '@angular/forms';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatLegacyOptionModule as MatOptionModule } from '@angular/material/legacy-core';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatExpansionModule } from '@angular/material/expansion';
import { DesignModulesComponent } from './components/design-modules/design-modules.component';
import { DesignModuleComponent } from './components/design-modules/design-module/design-module.component';
import { ClipboardModule } from 'ngx-clipboard';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MatLegacySnackBarModule as MatSnackBarModule } from '@angular/material/legacy-snack-bar';
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
