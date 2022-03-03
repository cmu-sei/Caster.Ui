import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModuleOutputsComponent } from './module-outputs.component';

describe('OutputsComponent', () => {
  let component: ModuleOutputsComponent;
  let fixture: ComponentFixture<ModuleOutputsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModuleOutputsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModuleOutputsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
