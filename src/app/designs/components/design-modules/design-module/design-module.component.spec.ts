import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignModuleComponent } from './design-module.component';

describe('DesignModuleComponent', () => {
  let component: DesignModuleComponent;
  let fixture: ComponentFixture<DesignModuleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DesignModuleComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DesignModuleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
