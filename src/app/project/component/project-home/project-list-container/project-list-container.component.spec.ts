// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectListContainerComponent } from './project-list-container.component';

describe('ProjectContainerComponent', () => {
  let component: ProjectListContainerComponent;
  let fixture: ComponentFixture<ProjectListContainerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectListContainerComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectListContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
