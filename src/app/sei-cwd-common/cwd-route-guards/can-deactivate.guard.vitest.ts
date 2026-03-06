// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CanDeactivateGuard, CanComponentDeactivate } from './can-deactivate.guard';

describe('CanDeactivateGuard', () => {
  let guard: CanDeactivateGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CanDeactivateGuard],
    });
    guard = TestBed.inject(CanDeactivateGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should return true when component has no canDeactivate method', () => {
    const component = {} as CanComponentDeactivate;
    expect(guard.canDeactivate(component)).toBe(true);
  });

  it('should return true when component canDeactivate returns true', () => {
    const component: CanComponentDeactivate = {
      canDeactivate: () => true,
    };
    expect(guard.canDeactivate(component)).toBe(true);
  });
});
