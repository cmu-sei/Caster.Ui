import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignModulesComponent } from './design-modules.component';

describe('DesignModulesComponent', () => {
  let component: DesignModulesComponent;
  let fixture: ComponentFixture<DesignModulesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DesignModulesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DesignModulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
