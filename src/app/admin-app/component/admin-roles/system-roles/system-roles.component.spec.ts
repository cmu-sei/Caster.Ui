import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemRolesComponent } from './system-roles.component';

describe('SystemRolesComponent', () => {
  let component: SystemRolesComponent;
  let fixture: ComponentFixture<SystemRolesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SystemRolesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SystemRolesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
