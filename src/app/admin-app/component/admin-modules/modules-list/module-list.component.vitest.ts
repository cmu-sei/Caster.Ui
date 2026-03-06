// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { AdminModuleListComponent } from './module-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { Module } from 'src/app/generated/caster-api';

const mockModules: Module[] = [
  {
    id: 'am1',
    name: 'terraform-aws-vpc',
    path: 'registry/aws/vpc',
    versionsCount: 5,
    dateModified: '2024-06-15T10:00:00Z',
  },
  {
    id: 'am2',
    name: 'terraform-azure-network',
    path: 'registry/azure/network',
    versionsCount: 3,
    dateModified: '2024-07-20T14:30:00Z',
  },
  {
    id: 'am3',
    name: 'terraform-gcp-compute',
    path: 'registry/gcp/compute',
    versionsCount: 0,
    dateModified: '2024-08-10T08:00:00Z',
  },
];

function moduleDataSource(modules: Module[]): MatTableDataSource<Module> {
  return new MatTableDataSource(modules);
}

const sharedImports = [
  FormsModule,
  MatTableModule,
  MatSortModule,
  MatPaginatorModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,
  MatTooltipModule,
  MatIconModule,
  MatProgressSpinnerModule,
  MatDialogModule,
  ClipboardModule,
];

async function renderModuleList(
  overrides: {
    modules?: Module[];
    isLoading?: boolean;
    canEdit?: boolean;
    dataSource?: MatTableDataSource<Module>;
  } = {}
) {
  return renderComponent(AdminModuleListComponent, {
    declarations: [AdminModuleListComponent],
    imports: sharedImports,
    componentProperties: {
      modules: overrides.modules ?? [],
      isLoading: overrides.isLoading ?? false,
      canEdit: overrides.canEdit ?? false,
      ...(overrides.dataSource ? { dataSource: overrides.dataSource } : {}),
    } as any,
  });
}

describe('AdminModuleListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderModuleList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display modules in table', async () => {
    await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.getByText('terraform-aws-vpc')).toBeInTheDocument();
    expect(screen.getByText('terraform-azure-network')).toBeInTheDocument();
    expect(screen.getByText('terraform-gcp-compute')).toBeInTheDocument();
  });

  it('should filter modules by name', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'aws');
    expect(screen.getByText('terraform-aws-vpc')).toBeInTheDocument();
    expect(
      screen.queryByText('terraform-azure-network')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('terraform-gcp-compute')).not.toBeInTheDocument();
  });

  it('should filter modules case-insensitively', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'AZURE');
    expect(screen.getByText('terraform-azure-network')).toBeInTheDocument();
    expect(screen.queryByText('terraform-aws-vpc')).not.toBeInTheDocument();
  });

  it('should filter modules by path', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'registry/gcp');
    expect(screen.getByText('terraform-gcp-compute')).toBeInTheDocument();
    expect(screen.queryByText('terraform-aws-vpc')).not.toBeInTheDocument();
    expect(
      screen.queryByText('terraform-azure-network')
    ).not.toBeInTheDocument();
  });

  it('should show no rows when search has no match', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'zzz_no_match');
    expect(screen.queryByText('terraform-aws-vpc')).not.toBeInTheDocument();
    expect(
      screen.queryByText('terraform-azure-network')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('terraform-gcp-compute')).not.toBeInTheDocument();
  });

  it('should clear search and restore all modules', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'aws');
    expect(
      screen.queryByText('terraform-azure-network')
    ).not.toBeInTheDocument();

    const clearButton = container.querySelector(
      'button[aria-label="Clear"]'
    ) as HTMLButtonElement;
    await userEvent.click(clearButton);
    expect(screen.getByText('terraform-aws-vpc')).toBeInTheDocument();
    expect(screen.getByText('terraform-azure-network')).toBeInTheDocument();
    expect(screen.getByText('terraform-gcp-compute')).toBeInTheDocument();
  });

  it('should show loading spinner when isLoading', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: true,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    expect(container.querySelector('mat-progress-spinner')).toBeInTheDocument();
  });

  it('should not show loading spinner when not loading', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    expect(container.querySelector('mat-progress-spinner')).toBeNull();
  });

  it('should show Add/Update section when canEdit is true', async () => {
    await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: true,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.getByText(/Add\/Update Modules/)).toBeInTheDocument();
  });

  it('should hide Add/Update section when canEdit is false', async () => {
    await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.queryByText(/Add\/Update Modules/)).not.toBeInTheDocument();
  });

  it('should show delete button per module when canEdit', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: true,
      dataSource: moduleDataSource(mockModules),
    });

    expect(
      container.querySelectorAll('button[title="Delete Module"]')
    ).toHaveLength(mockModules.length);
  });

  it('should hide delete buttons when canEdit is false', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    expect(container.querySelector('button[title="Delete Module"]')).toBeNull();
  });

  it('should show table headers', async () => {
    await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Path')).toBeInTheDocument();
    expect(screen.getByText('Versions')).toBeInTheDocument();
    expect(screen.getByText('Date Loaded')).toBeInTheDocument();
  });

  it('should show copy ID button per module', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      isLoading: false,
      canEdit: false,
      dataSource: moduleDataSource(mockModules),
    });

    expect(container.querySelectorAll('button[title^="Copy:"]')).toHaveLength(
      mockModules.length
    );
  });
});
