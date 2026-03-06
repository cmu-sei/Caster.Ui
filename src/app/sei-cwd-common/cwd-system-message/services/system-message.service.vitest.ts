// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { SystemMessageService } from './system-message.service';

describe('SystemMessageService', () => {
  it('should be created', () => {
    TestBed.configureTestingModule({
      providers: [
        SystemMessageService,
        { provide: MatBottomSheet, useValue: { open: () => {} } },
      ],
    });
    const service = TestBed.inject(SystemMessageService);
    expect(service).toBeTruthy();
  });
});
