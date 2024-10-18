import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectMembershipsComponent } from './project-memberships.component';

describe('ProjectMembershipsComponent', () => {
  let component: ProjectMembershipsComponent;
  let fixture: ComponentFixture<ProjectMembershipsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProjectMembershipsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectMembershipsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
