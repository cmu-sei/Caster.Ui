/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VlanListComponent } from './vlan-list.component';

describe('VlanListComponent', () => {
  let component: VlanListComponent;
  let fixture: ComponentFixture<VlanListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VlanListComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VlanListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
