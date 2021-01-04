// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiveRunsComponent } from './active-runs.component';

describe('ActiveRunsComponent', () => {
  let component: ActiveRunsComponent;
  let fixture: ComponentFixture<ActiveRunsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ActiveRunsComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ActiveRunsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
