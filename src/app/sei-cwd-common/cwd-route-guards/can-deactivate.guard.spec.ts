// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockInstance,
} from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  CanComponentDeactivate,
  CanDeactivateGuard,
} from './can-deactivate.guard';

const WARNING =
  'WARNING: You have unsaved changes. Press Cancel to go back and save these changes, or OK to lose these changes.';

describe('CanDeactivateGuard', () => {
  let guard: CanDeactivateGuard;
  let confirm: MockInstance<typeof window.confirm>;

  beforeEach(() => {
    guard = TestBed.inject(CanDeactivateGuard);
    // jsdom doesn't implement window.confirm; the spy stands in for the user.
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  /**
   * Verifies: a routed component without a canDeactivate method may always leave, without a prompt.
   * Interacts with: window.confirm (spied).
   * Data: a component object with no canDeactivate.
   */
  it('allows leaving a component that has no canDeactivate', () => {
    const component = {} as CanComponentDeactivate;

    expect(guard.canDeactivate(component)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  /**
   * Verifies: when canDeactivate returns true (no unsaved changes), the guard allows leaving without a prompt.
   * Interacts with: the component's canDeactivate, window.confirm (spied).
   * Data: canDeactivate returns true.
   */
  it('allows leaving without a prompt when there are no unsaved changes', () => {
    const component: CanComponentDeactivate = { canDeactivate: () => true };

    expect(guard.canDeactivate(component)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  /**
   * Verifies: with unsaved changes, the guard asks the user once and returns their answer.
   * Interacts with: the component's canDeactivate, window.confirm (spied).
   * Data: canDeactivate returns false; the user answers OK (true) or Cancel (false).
   */
  it.each([
    { answer: 'OK', confirmed: true },
    { answer: 'Cancel', confirmed: false },
  ])(
    'asks before discarding unsaved changes and follows $answer',
    ({ confirmed }) => {
      const component: CanComponentDeactivate = { canDeactivate: () => false };
      confirm.mockReturnValueOnce(confirmed);

      expect(guard.canDeactivate(component)).toBe(confirmed);
      expect(confirm.mock.calls).toEqual([[WARNING]]);
    },
  );

  /**
   * Verifies: an Observable or Promise result is treated as "no unsaved changes" because it is truthy, so the user is never asked.
   * Interacts with: the component's canDeactivate, window.confirm (spied).
   * Data: canDeactivate returns of(false) or Promise.resolve(false).
   */
  it.each([
    { kind: 'Observable', result: () => of(false) },
    { kind: 'Promise', result: () => Promise.resolve(false) },
  ])('skips the prompt for an async ($kind) false', ({ result }) => {
    expect(guard.canDeactivate({ canDeactivate: result })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
