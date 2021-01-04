// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminModuleListComponent } from './module-list.component';

describe('ModuleListComponent', () => {
  let component: AdminModuleListComponent;
  let fixture: ComponentFixture<AdminModuleListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [AdminModuleListComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminModuleListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
