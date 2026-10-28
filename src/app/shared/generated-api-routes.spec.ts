// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BASE_PATH,
  DesignsModulesService,
  ProjectsService,
  VariablesService,
} from '../generated/caster-api';

/**
 * The generated client was hand-edited to call the corrected routes (the
 * project export and import routes stacked the class route twice, and two
 * design routes were misspelled). These pin the paths the client requests so
 * a regeneration against an older API cannot quietly bring the old ones back.
 */
describe('generated API client routes', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: 'http://api' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('exports a project from api/projects/{id}/actions/export', () => {
    TestBed.inject(ProjectsService).exportProject('p1').subscribe();
    const req = http.expectOne(
      (r) => r.url === 'http://api/api/projects/p1/actions/export',
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob());
  });

  it('imports a project to api/projects/{id}/actions/import', () => {
    TestBed.inject(ProjectsService).importProject('p1').subscribe();
    const req = http.expectOne(
      (r) => r.url === 'http://api/api/projects/p1/actions/import',
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('gets the variables of a design from api/designs/{designId}/variables', () => {
    TestBed.inject(VariablesService).getVariablesByDesign('d1').subscribe();
    const req = http.expectOne('http://api/api/designs/d1/variables');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('deletes a design module at api/designModules/{id}', () => {
    TestBed.inject(DesignsModulesService).deleteDesignModule('m1').subscribe();
    const req = http.expectOne('http://api/api/designModules/m1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
