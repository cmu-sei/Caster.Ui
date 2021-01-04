// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CwdToolbarActionItemComponent } from './cwd-toolbar-action-item.component';

describe('CwdToolbarActionItemComponent', () => {
  let component: CwdToolbarActionItemComponent;
  let fixture: ComponentFixture<CwdToolbarActionItemComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CwdToolbarActionItemComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CwdToolbarActionItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
