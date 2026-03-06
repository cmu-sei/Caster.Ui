// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, ViewChild } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of, firstValueFrom } from 'rxjs';
import { CwdTableComponent } from './cwd-table.component';
import { TableActionDirective } from '../../directives/table-action.directive';
import { TableItemActionDirective } from '../../directives/table-item-action.directive';
import { TableItemContentDirective } from '../../directives/table-item-content.directive';

interface MockItem {
  id: string;
  name: string;
  category: string;
}

const mockItems: MockItem[] = [
  { id: 'i1', name: 'Server Alpha', category: 'production' },
  { id: 'i2', name: 'Server Beta', category: 'staging' },
  { id: 'i3', name: 'Server Gamma', category: 'development' },
];

@Component({
  selector: 'cas-test-host',
  template: `
    <cwd-table
      [items]="items"
      [displayedColumns]="displayedColumns"
      [loading]="loading"
    ></cwd-table>
  `,
  standalone: false,
})
class TestHostComponent {
  @ViewChild(CwdTableComponent) table: CwdTableComponent<MockItem>;
  items: MockItem[] = mockItems;
  displayedColumns: (keyof MockItem)[] = ['name', 'category'];
  loading = false;
}

describe('CwdTableComponent', () => {
  let hostFixture: any;
  let host: TestHostComponent;
  let table: CwdTableComponent<MockItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        CwdTableComponent,
        TableActionDirective,
        TableItemActionDirective,
        TableItemContentDirective,
        TestHostComponent,
      ],
      imports: [
        NoopAnimationsModule,
        CommonModule,
        FormsModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatCardModule,
        MatIconTestingModule,
      ],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    host = hostFixture.componentInstance;
    hostFixture.detectChanges();
    table = host.table;
  });

  it('should create', () => {
    expect(table).toBeTruthy();
  });

  it('should have items in datasource', () => {
    expect(table.datasource.data.length).toBe(3);
  });

  it('should filter items by name', () => {
    table.applyFilter('Alpha');
    expect(table.datasource.filteredData.length).toBe(1);
    expect(table.datasource.filteredData[0].name).toBe('Server Alpha');
  });

  it('should filter items case-insensitively', () => {
    table.applyFilter('beta');
    expect(table.datasource.filteredData.length).toBe(1);
    expect(table.datasource.filteredData[0].name).toBe('Server Beta');
  });

  it('should filter items by category', () => {
    table.applyFilter('staging');
    expect(table.datasource.filteredData.length).toBe(1);
    expect(table.datasource.filteredData[0].name).toBe('Server Beta');
  });

  it('should show no items when search has no match', () => {
    table.applyFilter('zzz_no_match');
    expect(table.datasource.filteredData.length).toBe(0);
  });

  it('should clear search and restore all items', () => {
    table.applyFilter('Alpha');
    expect(table.datasource.filteredData.length).toBe(1);

    table.clearFilter();
    expect(table.datasource.filteredData.length).toBe(3);
  });

  it('should show loading state', () => {
    host.loading = true;
    hostFixture.detectChanges();
    expect(table.loading).toBe(true);
  });

  it('should not show loading state when not loading', () => {
    expect(table.loading).toBe(false);
  });

  it('should display column headers', () => {
    expect(table.displayedColumns).toEqual(['name', 'category']);
  });

  it('should filter by partial match', () => {
    table.applyFilter('Server');
    expect(table.datasource.filteredData.length).toBe(3);
  });
});
