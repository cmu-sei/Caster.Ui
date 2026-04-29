// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { User } from 'src/app/generated/caster-api';
import { AdminGroupsMembershipListComponent } from './admin-groups-membership-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const users: User[] = [
  { id: 'u1', name: 'Alice' } as User,
  { id: 'u2', name: 'Bob' } as User,
];

async function renderList(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = false } = overrides;
  return renderComponent(AdminGroupsMembershipListComponent, {
    declarations: [AdminGroupsMembershipListComponent],
    imports: [MatTableModule, MatSortModule, MatPaginatorModule, MatSnackBarModule],
    componentProperties: { users, canEdit },
  });
}

describe('AdminGroupsMembershipListComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('populates data source from users on ngOnChanges', async () => {
    const { fixture } = await renderList();
    expect(fixture.componentInstance.dataSource.data).toEqual(users);
  });

  it('shows only view columns when canEdit=false', async () => {
    const { fixture } = await renderList({ canEdit: false });
    expect(fixture.componentInstance.displayedColumns).toEqual(['name']);
  });

  it('adds edit column when canEdit=true', async () => {
    const { fixture } = await renderList({ canEdit: true });
    expect(fixture.componentInstance.displayedColumns).toEqual([
      'name',
      'actions',
    ]);
  });

  it('add(id) emits { userId } on createMembership', async () => {
    const { fixture } = await renderList();
    const spy = vi.fn();
    fixture.componentInstance.createMembership.subscribe(spy);
    fixture.componentInstance.add('u1');
    expect(spy).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('applyFilter lowercases + trims the filter value', async () => {
    const { fixture } = await renderList();
    fixture.componentInstance.applyFilter({
      target: { value: '  ALICE  ' },
    } as unknown as Event);
    expect(fixture.componentInstance.dataSource.filter).toBe('alice');
  });

  it('clearFilter resets the filter', async () => {
    const { fixture } = await renderList();
    fixture.componentInstance.applyFilter({
      target: { value: 'x' },
    } as unknown as Event);
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.filterString).toBe('');
    expect(fixture.componentInstance.dataSource.filter).toBe('');
  });
});
