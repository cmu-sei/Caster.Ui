// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import { renderComponent } from 'src/app/test-utils/render-component';
import { CurrentUserStore } from 'src/app/users/state/user.store';
import { CurrentUserBadgeComponent } from './current-user-badge.component';

async function renderBadge(userId: string) {
  const view = await renderComponent(CurrentUserBadgeComponent, {
    inputs: { userId },
  });
  TestBed.inject(CurrentUserStore).update({ id: 'u1', name: 'Ada' });
  view.fixture.detectChanges();
  return view;
}

describe('CurrentUserBadgeComponent', () => {
  /**
   * Verifies: the badge says You next to the signed-in user.
   * Interacts with: real CurrentUserQuery.
   * Data: current user u1; userId u1.
   */
  it('marks the current user', async () => {
    await renderBadge('u1');

    expect(screen.getByText('You')).toBeInTheDocument();
  });

  /**
   * Verifies: the badge renders nothing for another user.
   * Interacts with: real CurrentUserQuery.
   * Data: current user u1; userId u2.
   */
  it('renders nothing for another user', async () => {
    await renderBadge('u2');

    expect(screen.queryByText('You')).not.toBeInTheDocument();
  });
});
