import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuleOutputComponent } from './module-output.component';

describe('ModuleOutputComponent', () => {
  let component: ModuleOutputComponent;
  let fixture: ComponentFixture<ModuleOutputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModuleOutputComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModuleOutputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
