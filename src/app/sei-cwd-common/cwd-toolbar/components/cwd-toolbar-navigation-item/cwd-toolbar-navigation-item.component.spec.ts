// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CwdToolbarNavigationItemComponent } from './cwd-toolbar-navigation-item.component';

describe('CwdToolbarNavigationItemComponent', () => {
  let component: CwdToolbarNavigationItemComponent;
  let fixture: ComponentFixture<CwdToolbarNavigationItemComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CwdToolbarNavigationItemComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CwdToolbarNavigationItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
