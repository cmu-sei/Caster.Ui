/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectMembershipListComponent } from './project-membership-list.component';

describe('ProjectMembershipUserListComponent', () => {
  let component: ProjectMembershipListComponent;
  let fixture: ComponentFixture<ProjectMembershipListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectMembershipListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectMembershipListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
