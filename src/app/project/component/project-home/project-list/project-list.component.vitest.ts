// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTableDataSource } from '@angular/material/table';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ProjectListComponent } from './project-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import { SystemPermission, Project } from 'src/app/generated/caster-api';
import { SharedModule } from 'src/app/shared/shared.module';

const mockProjects: Project[] = [
  { id: 'p1', name: 'Alpha Project' },
  { id: 'p2', name: 'Beta Project' },
  { id: 'p3', name: 'Gamma Project' },
];

function projectDataSource(projects: Project[]): MatTableDataSource<Project> {
  return new MatTableDataSource(projects);
}

const sharedImports = [
  FormsModule,
  MatTableModule,
  MatSortModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,
  MatTooltipModule,
  MatProgressSpinnerModule,
  MatCardModule,
  MatIconModule,
  SharedModule,
];

async function renderProjectList(
  overrides: {
    projects?: Project[] | null;
    isLoading?: boolean;
    dataSource?: MatTableDataSource<Project>;
    manageMode?: boolean;
    providers?: any[];
  } = {}
) {
  const result = await renderComponent(ProjectListComponent, {
    declarations: [ProjectListComponent],
    imports: sharedImports,
    providers: overrides.providers,
    componentProperties: {
      projects: overrides.projects as any,
      isLoading: overrides.isLoading ?? false,
      ...(overrides.dataSource ? { dataSource: overrides.dataSource } : {}),
      ...(overrides.manageMode !== undefined
        ? { manageMode: overrides.manageMode }
        : {}),
    } as any,
  });
  return result;
}

describe('ProjectListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderProjectList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display project names in table', async () => {
    await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
    expect(screen.getByText('Gamma Project')).toBeInTheDocument();
  });

  it('should show loading spinner when isLoading', async () => {
    const { container } = await renderProjectList({
      projects: null,
      isLoading: true,
    });

    expect(container.querySelector('mat-progress-spinner')).toBeInTheDocument();
  });

  it('should show empty message when no projects match', async () => {
    await renderProjectList({
      projects: [],
      isLoading: false,
      dataSource: projectDataSource([]),
    });

    expect(
      screen.getByText('You are not a member of any Projects')
    ).toBeInTheDocument();
  });

  it('should filter projects by search input', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const input = container.querySelector(
      'input[placeholder="Search Projects"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Alpha');

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.queryByText('Beta Project')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Project')).not.toBeInTheDocument();
  });

  it('should clear filter when clear button clicked', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const input = container.querySelector(
      'input[placeholder="Search Projects"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Alpha');
    expect(screen.queryByText('Beta Project')).not.toBeInTheDocument();

    const clearButton = container.querySelector(
      'button[aria-label="Clear"]'
    ) as HTMLButtonElement;
    await userEvent.click(clearButton);

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
    expect(screen.getByText('Gamma Project')).toBeInTheDocument();
  });

  it('should filter case-insensitively', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const input = container.querySelector(
      'input[placeholder="Search Projects"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'alpha');

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.queryByText('Beta Project')).not.toBeInTheDocument();
  });

  it('should filter by partial match', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const input = container.querySelector(
      'input[placeholder="Search Projects"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'eta');

    expect(screen.getByText('Beta Project')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Project')).not.toBeInTheDocument();
  });

  it('should show no-match message when filter has no results', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const input = container.querySelector(
      'input[placeholder="Search Projects"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'zzz_nothing');

    expect(
      screen.getByText(/No data matching the filter/)
    ).toBeInTheDocument();
    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument();
  });

  it('should match multiple projects with shared substring', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const input = container.querySelector(
      'input[placeholder="Search Projects"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Project');

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
    expect(screen.getByText('Gamma Project')).toBeInTheDocument();
  });

  it('should show Add button with CreateProjects permission', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
      providers: [permissionProvider([SystemPermission.CreateProjects])],
    });

    expect(
      container.querySelector('button[matTooltip="Add New Project"]')
    ).toBeInTheDocument();
  });

  it('should hide Add button without CreateProjects permission', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
      providers: [permissionProvider([])],
    });

    expect(
      container.querySelector('button[matTooltip="Add New Project"]')
    ).toBeNull();
  });

  it('should show edit/delete buttons with ManageProjects permission', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
      providers: [permissionProvider([SystemPermission.ManageProjects])],
    });

    expect(
      container.querySelectorAll('button[matTooltip="Rename"]').length
    ).toBeGreaterThanOrEqual(1);
  });

  it('should hide edit/delete buttons without ManageProjects permission', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
      providers: [permissionProvider([])],
    });

    expect(
      container.querySelector('button[matTooltip="Rename"]')
    ).toBeNull();
  });

  it('should show delete button per project with ManageProjects permission', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
      providers: [permissionProvider([SystemPermission.ManageProjects])],
    });

    expect(
      container.querySelectorAll('button[matTooltip="Rename"]')
    ).toHaveLength(mockProjects.length);
    expect(
      container.querySelectorAll('mat-icon[fontIcon="fa-trash"]')
    ).toHaveLength(mockProjects.length);
  });

  it('should not show clear button when filter is empty', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    expect(
      container.querySelector('button[aria-label="Clear"]')
    ).toBeNull();
  });

  it('should show clear button when filter has text', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const input = container.querySelector(
      'input[placeholder="Search Projects"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Alpha');

    expect(
      container.querySelector('button[aria-label="Clear"]')
    ).toBeInTheDocument();
  });

  it('should render project links with routerLink', async () => {
    const { container } = await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    const link = container.querySelector('a.project-text') as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toContain('/projects/');
  });

  it('should display table headers', async () => {
    await renderProjectList({
      projects: mockProjects,
      isLoading: false,
      dataSource: projectDataSource(mockProjects),
    });

    expect(screen.getByText('Project Name')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});
