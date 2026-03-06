// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ErrorService } from './error.service';

describe('ErrorService', () => {
  it('should be created', () => {
    TestBed.configureTestingModule({
      providers: [ErrorService],
    });
    const service = TestBed.inject(ErrorService);
    expect(service).toBeTruthy();
  });
});
