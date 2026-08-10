// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { RoleService } from 'src/app/roles/roles.service.service';

import { AddUserDialogComponent } from './add-user-dialog.component';

describe('AddUserDialogComponent', () => {
  let component: AddUserDialogComponent;
  let fixture: ComponentFixture<AddUserDialogComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<AddUserDialogComponent>>;

  const validGuid = '3f0b1a52-9c4d-4e7f-8a1b-2c3d4e5f6a7b';

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj<MatDialogRef<AddUserDialogComponent>>(
      'MatDialogRef',
      ['close']
    );

    await TestBed.configureTestingModule({
      declarations: [AddUserDialogComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: RoleService, useValue: { roles$: of([]) } },
      ],
    })
      // These specs exercise the form/close logic; the template renders
      // <crucible-dialog> and Material fields, which are covered by the
      // shared component's own specs.
      .overrideComponent(AddUserDialogComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(AddUserDialogComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start invalid and pristine so the primary action is disabled', () => {
    expect(component.form.valid).toBeFalse();
    expect(component.form.dirty).toBeFalse();
  });

  it('should reject an id that is not a guid', () => {
    component.form.patchValue({ id: 'not-a-guid', name: 'Test User' });

    expect(component.id.hasError('pattern')).toBeTrue();
    expect(component.form.valid).toBeFalse();
  });

  it('should reject a name shorter than 4 characters', () => {
    component.form.patchValue({ id: validGuid, name: 'abc' });

    expect(component.name.hasError('minlength')).toBeTrue();
    expect(component.form.valid).toBeFalse();
  });

  it('should be valid with a guid id and a 4 character name', () => {
    component.form.patchValue({ id: validGuid, name: 'Test User' });

    expect(component.form.valid).toBeTrue();
  });

  it('should close with the new user on submit', () => {
    component.form.patchValue({
      id: validGuid,
      name: 'Test User',
      roleId: 'role-1',
    });

    component.onSubmit();

    expect(dialogRef.close).toHaveBeenCalledWith({
      id: validGuid,
      name: 'Test User',
      roleId: 'role-1',
    });
  });

  it('should close with a null roleId when no role is selected', () => {
    component.form.patchValue({ id: validGuid, name: 'Test User' });

    component.onSubmit();

    expect(dialogRef.close).toHaveBeenCalledWith({
      id: validGuid,
      name: 'Test User',
      roleId: null,
    });
  });
});
