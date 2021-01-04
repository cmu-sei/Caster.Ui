// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { TestBed } from '@angular/core/testing';

import { FilesFilterPipe } from './files-filter-pipe';

describe('FilesFilterPipeService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: FilesFilterPipe = TestBed.get(FilesFilterPipe);
    expect(service).toBeTruthy();
  });
});
