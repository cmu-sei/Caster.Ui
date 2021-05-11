// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportResourceComponent } from './import-resource.component';

describe('ImportResourceComponent', () => {
  let component: ImportResourceComponent;
  let fixture: ComponentFixture<ImportResourceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ImportResourceComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ImportResourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
