// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { ReactiveFormsModule } from '@angular/forms';
import { VlanListComponent } from './vlan-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { Vlan } from 'src/app/generated/caster-api';

const mockVlans: Vlan[] = [
  {
    id: 'v1',
    vlanId: 10,
    inUse: false,
    reserved: false,
    reservedEditable: true,
    tag: 'alpha-tag',
    partitionId: 'p1',
  },
  {
    id: 'v2',
    vlanId: 20,
    inUse: true,
    reserved: false,
    reservedEditable: true,
    tag: 'beta-tag',
    partitionId: 'p1',
  },
  {
    id: 'v3',
    vlanId: 30,
    inUse: false,
    reserved: true,
    reservedEditable: true,
    tag: 'gamma-tag',
    partitionId: null,
  },
  {
    id: 'v4',
    vlanId: 100,
    inUse: false,
    reserved: false,
    reservedEditable: true,
    tag: 'delta-tag',
    partitionId: 'p1',
  },
  {
    id: 'v5',
    vlanId: 150,
    inUse: false,
    reserved: false,
    reservedEditable: true,
    tag: 'alpha-second',
    partitionId: 'p1',
  },
];

const sharedImports = [
  ReactiveFormsModule,
  MatTableModule,
  MatSortModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,
  MatCheckboxModule,
  MatIconModule,
  MatMenuModule,
  MatSelectModule,
];

async function renderVlanList(
  overrides: {
    vlans?: Vlan[];
    canEdit?: boolean;
    displayedColumns?: string[];
  } = {}
) {
  const result = await renderComponent(VlanListComponent, {
    declarations: [VlanListComponent],
    imports: sharedImports,
    componentProperties: {
      vlans: overrides.vlans ?? [],
      canEdit: overrides.canEdit ?? false,
      ...(overrides.displayedColumns
        ? { displayedColumns: overrides.displayedColumns }
        : {}),
    } as any,
  });

  return result;
}

describe('VlanListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderVlanList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display vlans in table', async () => {
    await renderVlanList({ vlans: mockVlans, canEdit: false });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('should filter vlans by tag text', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, 'beta', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('30')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('should filter vlans by exact VLAN ID', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, '30', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);

    expect(screen.getByText('30')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('should filter vlans by ID range', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, '15-25', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('30')).not.toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('should filter vlans by comma-separated IDs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, '10,30', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('should filter vlans case-insensitively by tag', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, 'GAMMA', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);

    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('should show no rows when search has no match', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, 'zzz_no_match', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);

    expect(screen.getByText(/No data matching the filter/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('should clear search and restore all vlans', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container, fixture } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, 'beta', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);
    fixture.detectChanges();

    expect(screen.queryByText('10')).not.toBeInTheDocument();

    const clearButton = container.querySelector('button[aria-label="Clear"]') as HTMLButtonElement;
    await userEvent.click(clearButton);
    vi.advanceTimersByTime(600);
    fixture.detectChanges();

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('should show select column and actions column when canEdit is true', async () => {
    const { container } = await renderVlanList({
      vlans: mockVlans,
      canEdit: true,
      displayedColumns: ['select', 'vlanId', 'inUse', 'reserved', 'tag', 'actions'],
    });

    expect(container.querySelector('mat-checkbox')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should hide select and actions columns when canEdit is false', async () => {
    const { container } = await renderVlanList({
      vlans: mockVlans,
      canEdit: false,
      displayedColumns: ['vlanId', 'inUse', 'reserved', 'tag'],
    });

    expect(container.querySelector('mat-checkbox')).toBeNull();
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('should show Selected button with count', async () => {
    await renderVlanList({ vlans: mockVlans, canEdit: true });

    expect(screen.getByText(/0 Selected/)).toBeInTheDocument();
  });

  it('should filter with mixed ID and range comma-separated', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderVlanList({ vlans: mockVlans, canEdit: false });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    await userEvent.type(input, '10,90-110', { advanceTimers: vi.advanceTimersByTime });
    vi.advanceTimersByTime(600);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.queryByText('20')).not.toBeInTheDocument();
    expect(screen.queryByText('30')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
