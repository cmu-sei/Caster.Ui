// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
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

let version = 0;

/** Shows `present` in the bar, as a state the hub sent for the open project. */
function show(present: PresentUser[]) {
  TestBed.inject(ProjectPresenceService).apply(
    { projectId: 'p1', version: ++version, users: present },
    'p1',
  );
}

/** Renders the bar over the real ProjectPresenceService, seeded with `present`. */
async function renderPresence(present: PresentUser[]) {
  const view = await renderComponent(ProjectPresenceComponent);
  show(present);
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
   * Verifies: each other user is a list item named for them, and the group says who is in the project.
   * Interacts with: ProjectPresenceService (real).
   * Data: Bob and Ada present; listed sorted by name.
   */
  it('lists the other users in the project by name', async () => {
    await renderPresence([
      { id: 'u3', name: 'Bob' },
      { id: 'u2', name: 'Ada' },
    ]);

    expect(
      screen.getByRole('group', { name: 'Also in this project: Ada, Bob' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Also here:')).toBeVisible();
    expect(
      screen.getAllByRole('listitem').map((x) => x.textContent.trim()),
    ).toEqual(['Ada', 'Bob']);
  });

  /**
   * Verifies: a newer state without a user removes their chip.
   * Interacts with: ProjectPresenceService.apply (real).
   * Data: Ada and Bob present; the next state has only Bob.
   */
  it('drops a user who departs', async () => {
    const view = await renderPresence([
      { id: 'u2', name: 'Ada' },
      { id: 'u3', name: 'Bob' },
    ]);

    show([{ id: 'u3', name: 'Bob' }]);
    view.fixture.detectChanges();

    // Chips, not text: the tooltip's describedby message repeats each name.
    expect(
      screen.getAllByRole('listitem').map((x) => x.textContent.trim()),
    ).toEqual(['Bob']);
    expect(
      screen.getByRole('group', { name: 'Also in this project: Bob' }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: beyond the maximum, the rest fold into one "+N" button naming them, and the group's label
   * counts them rather than listing them.
   * Interacts with: ProjectPresenceService (real).
   * Data: MAX_SHOWN_PRESENT_USERS + 2 users, User A onwards.
   */
  it('folds users beyond the maximum into a +N button', async () => {
    const present = users(MAX_SHOWN_PRESENT_USERS + 2);
    await renderPresence(present);

    expect(screen.getAllByRole('listitem')).toHaveLength(
      MAX_SHOWN_PRESENT_USERS + 1,
    );
    const hidden = present.slice(MAX_SHOWN_PRESENT_USERS).map((x) => x.name);
    const more = screen.getByRole('button', {
      name: `2 more: ${hidden.join(', ')}`,
    });
    expect(more).toHaveTextContent('+2');
    expect(more.closest('[role="listitem"]')).not.toBeNull();
    expect(
      screen.getByRole('group', {
        name: `Also in this project: ${present
          .slice(0, MAX_SHOWN_PRESENT_USERS)
          .map((x) => x.name)
          .join(', ')} and 2 others`,
      }),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: the +N button opens a list of everyone who didn't fit.
   * Interacts with: ProjectPresenceService (real), MatMenu.
   * Data: MAX_SHOWN_PRESENT_USERS + 2 users; the button is clicked.
   */
  it('lists the folded users in a menu opened by the +N button', async () => {
    const present = users(MAX_SHOWN_PRESENT_USERS + 2);
    await renderPresence(present);

    await userEvent.click(screen.getByRole('button', { name: /^2 more/ }));

    for (const user of present.slice(MAX_SHOWN_PRESENT_USERS)) {
      expect(await screen.findByText(user.name)).toBeInTheDocument();
    }
  });

  /**
   * Verifies: a user with no name still shows, as "Unknown user", in the chip and the label.
   * Interacts with: ProjectPresenceService (real).
   * Data: one user with an empty name, one with Ada.
   */
  it('shows a user without a name as Unknown user', async () => {
    await renderPresence([
      { id: 'u2', name: 'Ada' },
      { id: 'u3', name: '' },
    ]);

    expect(
      screen.getByRole('group', {
        name: 'Also in this project: Unknown user, Ada',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((x) => x.textContent.trim()),
    ).toEqual(['Unknown user', 'Ada']);
  });
});
