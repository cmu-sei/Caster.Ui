// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import {
  PresentUser,
  ProjectPresenceService,
} from 'src/app/project/state/project-presence.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import {
  MAX_SHOWN_PRESENT_USERS,
  ProjectPresenceComponent,
} from './project-presence.component';

function users(count: number): PresentUser[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `u${i + 10}`,
    name: `User ${String.fromCharCode(65 + i)}`,
  }));
}

/** Renders the bar over the real ProjectPresenceService, seeded with `present`. */
async function renderPresence(present: PresentUser[]) {
  const view = await renderComponent(ProjectPresenceComponent);
  TestBed.inject(ProjectPresenceService).set(present);
  view.fixture.detectChanges();
  return view;
}

describe('ProjectPresenceComponent', () => {
  /**
   * Verifies: with nobody else present the bar renders nothing.
   * Interacts with: ProjectPresenceService (real).
   * Data: no present users.
   */
  it('renders nothing when nobody else is present', async () => {
    await renderPresence([]);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  /**
   * Verifies: each other user is a list item named for them, and the list says who is in the project.
   * Interacts with: ProjectPresenceService (real).
   * Data: Bob and Ada present; listed sorted by name.
   */
  it('lists the other users in the project by name', async () => {
    await renderPresence([
      { id: 'u3', name: 'Bob' },
      { id: 'u2', name: 'Ada' },
    ]);

    const list = screen.getByRole('list', {
      name: 'Also in this project: Ada, Bob',
    });
    expect(list).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((x) => x.textContent.trim()),
    ).toEqual(['Ada', 'Bob']);
  });

  /**
   * Verifies: a live departure removes the user's chip.
   * Interacts with: ProjectPresenceService.departed (real).
   * Data: Ada and Bob present; Ada departs.
   */
  it('drops a user who departs', async () => {
    const view = await renderPresence([
      { id: 'u2', name: 'Ada' },
      { id: 'u3', name: 'Bob' },
    ]);

    TestBed.inject(ProjectPresenceService).departed({ id: 'u2', name: 'Ada' });
    view.fixture.detectChanges();

    // Chips, not text: the tooltip's describedby message repeats each name.
    expect(
      screen.getAllByRole('listitem').map((x) => x.textContent.trim()),
    ).toEqual(['Bob']);
    expect(
      screen.getByRole('list', { name: 'Also in this project: Bob' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: beyond the maximum, the rest fold into one "+N" chip naming them.
   * Interacts with: ProjectPresenceService (real).
   * Data: MAX_SHOWN_PRESENT_USERS + 2 users, User A onwards.
   */
  it('folds users beyond the maximum into a +N chip', async () => {
    const present = users(MAX_SHOWN_PRESENT_USERS + 2);
    await renderPresence(present);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(MAX_SHOWN_PRESENT_USERS + 1);
    const hidden = present.slice(MAX_SHOWN_PRESENT_USERS).map((x) => x.name);
    expect(
      screen.getByRole('listitem', { name: `2 more: ${hidden.join(', ')}` }),
    ).toHaveTextContent('+2');
  });
});
