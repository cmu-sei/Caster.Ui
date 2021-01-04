// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed, inject } from '@angular/core/testing';

import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfirmDialogService],
    });
  });

  it('should be created', inject(
    [ConfirmDialogService],
    (service: ConfirmDialogService) => {
      expect(service).toBeTruthy();
    }
  ));
});
