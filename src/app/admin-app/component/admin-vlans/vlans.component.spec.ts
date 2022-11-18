/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VlansComponent } from './vlans.component';

describe('VlansComponent', () => {
  let component: VlansComponent;
  let fixture: ComponentFixture<VlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VlansComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VlansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
