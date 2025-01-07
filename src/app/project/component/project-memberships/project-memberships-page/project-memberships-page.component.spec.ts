/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectMembershipsPageComponent } from './project-memberships-page.component';

describe('ProjectMembershipsPageComponent', () => {
  let component: ProjectMembershipsPageComponent;
  let fixture: ComponentFixture<ProjectMembershipsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProjectMembershipsPageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectMembershipsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
