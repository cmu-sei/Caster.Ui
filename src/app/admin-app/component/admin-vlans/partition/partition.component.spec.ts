/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartitionComponent } from './partition.component';

describe('PartitionComponent', () => {
  let component: PartitionComponent;
  let fixture: ComponentFixture<PartitionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PartitionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PartitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
