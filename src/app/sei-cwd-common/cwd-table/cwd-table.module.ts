// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CwdTableComponent } from './components/cwd-table/cwd-table.component';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { FormsModule } from '@angular/forms';
import { TableItemContentDirective } from './directives/table-item-content.directive';
import { TableActionDirective } from './directives/table-action.directive';
import { TableItemActionDirective } from './directives/table-item-action.directive';

@NgModule({
  declarations: [
    CwdTableComponent,
    TableItemContentDirective,
    TableActionDirective,
    TableItemActionDirective,
  ],
  imports: [
    CommonModule,
    MatIconModule,
    MatFormFieldModule,
    MatPaginatorModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatInputModule,
    MatSortModule,
    FormsModule,
  ],
  exports: [
    CwdTableComponent,
    TableItemContentDirective,
    TableActionDirective,
    TableItemActionDirective,
  ],
})
export class CwdTableModule {}
