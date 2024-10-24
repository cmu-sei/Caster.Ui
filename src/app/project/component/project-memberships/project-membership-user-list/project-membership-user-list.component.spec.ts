import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectMembershipUserListComponent } from './project-membership-user-list.component';

describe('ProjectMembershipUserListComponent', () => {
  let component: ProjectMembershipUserListComponent;
  let fixture: ComponentFixture<ProjectMembershipUserListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProjectMembershipUserListComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectMembershipUserListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
