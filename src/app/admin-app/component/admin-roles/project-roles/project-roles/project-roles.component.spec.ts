/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectRolesComponent } from './project-roles.component';

describe('ProjectRolesComponent', () => {
  let component: ProjectRolesComponent;
  let fixture: ComponentFixture<ProjectRolesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProjectRolesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectRolesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
