// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  it('should be created', () => {
    TestBed.configureTestingModule({
      imports: [MatDialogModule],
      providers: [ConfirmDialogService],
    });
    const service = TestBed.inject(ConfirmDialogService);
    expect(service).toBeTruthy();
  });
});
