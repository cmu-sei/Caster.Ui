import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectVlansComponent } from './project-vlans.component';

describe('ProjectVlansComponent', () => {
  let component: ProjectVlansComponent;
  let fixture: ComponentFixture<ProjectVlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProjectVlansComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectVlansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
