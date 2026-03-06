// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTableDataSource } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ModuleListComponent } from './module-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { Module } from 'src/app/generated/caster-api';
import { SharedModule } from 'src/app/shared/shared.module';

const mockModules: Module[] = [
  {
    id: 'm1',
    name: 'vpc-module',
    path: 'modules/vpc',
    description: 'Creates a VPC network',
    versionsCount: 3,
  },
  {
    id: 'm2',
    name: 'ec2-instance',
    path: 'modules/ec2',
    description: 'Launches EC2 instances',
    versionsCount: 2,
  },
  {
    id: 'm3',
    name: 's3-bucket',
    path: 'modules/s3',
    description: 'Creates S3 storage buckets',
    versionsCount: 1,
  },
];

function moduleDataSource(modules: Module[]): MatTableDataSource<Module> {
  return new MatTableDataSource(modules);
}

const sharedImports = [
  FormsModule,
  MatCardModule,
  MatIconModule,
  MatInputModule,
  MatButtonModule,
  MatDialogModule,
  SharedModule,
];

async function renderModuleList(
  overrides: {
    modules?: Module[];
    dataSource?: MatTableDataSource<Module>;
  } = {}
) {
  return renderComponent(ModuleListComponent, {
    declarations: [ModuleListComponent],
    imports: sharedImports,
    componentProperties: {
      ...(overrides.modules ? { modules: overrides.modules } : {}),
      ...(overrides.dataSource ? { dataSource: overrides.dataSource } : {}),
    } as any,
  });
}

describe('ModuleListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderModuleList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display module cards', async () => {
    await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.getByText('vpc-module')).toBeInTheDocument();
    expect(screen.getByText('ec2-instance')).toBeInTheDocument();
    expect(screen.getByText('s3-bucket')).toBeInTheDocument();
  });

  it('should show MODULES heading', async () => {
    await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.getByText('MODULES')).toBeInTheDocument();
  });

  it('should filter modules by name', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'vpc');

    expect(screen.getByText('vpc-module')).toBeInTheDocument();
    expect(screen.queryByText('ec2-instance')).not.toBeInTheDocument();
    expect(screen.queryByText('s3-bucket')).not.toBeInTheDocument();
  });

  it('should filter modules case-insensitively', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'EC2');

    expect(screen.getByText('ec2-instance')).toBeInTheDocument();
    expect(screen.queryByText('vpc-module')).not.toBeInTheDocument();
  });

  it('should filter modules by path', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'modules/s3');

    expect(screen.getByText('s3-bucket')).toBeInTheDocument();
    expect(screen.queryByText('vpc-module')).not.toBeInTheDocument();
    expect(screen.queryByText('ec2-instance')).not.toBeInTheDocument();
  });

  it('should filter modules by description', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'storage');

    expect(screen.getByText('s3-bucket')).toBeInTheDocument();
    expect(screen.queryByText('vpc-module')).not.toBeInTheDocument();
  });

  it('should show no modules when search has no match', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'zzz_no_match');

    expect(screen.queryByText('vpc-module')).not.toBeInTheDocument();
    expect(screen.queryByText('ec2-instance')).not.toBeInTheDocument();
    expect(screen.queryByText('s3-bucket')).not.toBeInTheDocument();
  });

  it('should clear search and restore all modules', async () => {
    const { container } = await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'vpc');
    expect(screen.queryByText('ec2-instance')).not.toBeInTheDocument();

    const clearButton = container.querySelector(
      'button[aria-label="Clear"]'
    ) as HTMLButtonElement;
    await userEvent.click(clearButton);

    expect(screen.getByText('vpc-module')).toBeInTheDocument();
    expect(screen.getByText('ec2-instance')).toBeInTheDocument();
    expect(screen.getByText('s3-bucket')).toBeInTheDocument();
  });

  it('should show module descriptions', async () => {
    await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.getByText('Creates a VPC network')).toBeInTheDocument();
    expect(screen.getByText('Launches EC2 instances')).toBeInTheDocument();
    expect(
      screen.getByText('Creates S3 storage buckets')
    ).toBeInTheDocument();
  });

  it('should show module paths', async () => {
    await renderModuleList({
      modules: mockModules,
      dataSource: moduleDataSource(mockModules),
    });

    expect(screen.getByText('modules/vpc')).toBeInTheDocument();
    expect(screen.getByText('modules/ec2')).toBeInTheDocument();
    expect(screen.getByText('modules/s3')).toBeInTheDocument();
  });
});
