// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CwdTableComponent } from './cwd-table.component';

describe('TempListComponent', () => {
  let component: CwdTableComponent;
  let fixture: ComponentFixture<CwdTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CwdTableComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CwdTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
