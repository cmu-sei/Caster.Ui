// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { GroupMembership, User } from 'src/app/generated/caster-api';
import { AdminGroupsMemberListComponent } from './admin-groups-member-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const users: User[] = [
  { id: 'u1', name: 'Alice' } as User,
  { id: 'u2', name: 'Bob' } as User,
];
const memberships: GroupMembership[] = [
  { id: 'm1', groupId: 'g1', userId: 'u1' } as GroupMembership,
  { id: 'm2', groupId: 'g1', userId: 'u2' } as GroupMembership,
];

async function renderList(overrides: { canEdit?: boolean } = {}) {
  const { canEdit = false } = overrides;
  return renderComponent(AdminGroupsMemberListComponent, {
    declarations: [AdminGroupsMemberListComponent],
    imports: [MatTableModule, MatSortModule, MatPaginatorModule],
    componentProperties: { memberships, users, canEdit },
  });
}

describe('AdminGroupsMemberListComponent', () => {
  it('creates the component', async () => {
    const { fixture } = await renderList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('builds data source from memberships + users on ngOnChanges', async () => {
    const { fixture } = await renderList();
    expect(fixture.componentInstance.dataSource.data.map((r) => r.name)).toEqual([
      'Alice',
      'Bob',
    ]);
  });

  it('displays only view columns when canEdit=false', async () => {
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

  it('delete(id) emits the id on deleteMembership output', async () => {
    const { fixture } = await renderList();
    const spy = vi.fn();
    fixture.componentInstance.deleteMembership.subscribe(spy);
    fixture.componentInstance.delete('m1');
    expect(spy).toHaveBeenCalledWith('m1');
  });

  it('applyFilter lowercases the filter value', async () => {
    const { fixture } = await renderList();
    fixture.componentInstance.applyFilter({
      target: { value: '  ALICE  ' },
    } as unknown as Event);
    expect(fixture.componentInstance.dataSource.filter).toBe('alice');
  });

  it('clearFilter resets the filter string', async () => {
    const { fixture } = await renderList();
    fixture.componentInstance.applyFilter({
      target: { value: 'a' },
    } as unknown as Event);
    fixture.componentInstance.clearFilter();
    expect(fixture.componentInstance.dataSource.filter).toBe('');
    expect(fixture.componentInstance.filterString).toBe('');
  });

  it('trackById returns the item id', async () => {
    const { fixture } = await renderList();
    expect(fixture.componentInstance.trackById(0, { id: 'x' })).toBe('x');
  });
});
