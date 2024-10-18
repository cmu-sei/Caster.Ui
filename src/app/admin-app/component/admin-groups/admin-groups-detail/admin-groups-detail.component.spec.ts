import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminGroupsDetailComponent } from './admin-groups-detail.component';

describe('AdminGroupsDetailComponent', () => {
  let component: AdminGroupsDetailComponent;
  let fixture: ComponentFixture<AdminGroupsDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminGroupsDetailComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminGroupsDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
