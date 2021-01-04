// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CwdTableComponent } from './components/cwd-table/cwd-table.component';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule } from '@angular/material/sort';
import { FlexModule, ExtendedModule } from '@angular/flex-layout';
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
    FlexModule,
    ExtendedModule,
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
