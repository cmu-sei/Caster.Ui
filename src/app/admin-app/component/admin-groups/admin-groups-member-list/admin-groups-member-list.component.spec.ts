import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminGroupsMemberListComponent } from './admin-groups-member-list.component';

describe('AdminGroupsMemberListComponent', () => {
  let component: AdminGroupsMemberListComponent;
  let fixture: ComponentFixture<AdminGroupsMemberListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminGroupsMemberListComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminGroupsMemberListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});