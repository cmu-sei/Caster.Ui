/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartitionListComponent } from './partition-list.component';

describe('PartitionListComponent', () => {
  let component: PartitionListComponent;
  let fixture: ComponentFixture<PartitionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PartitionListComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PartitionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
