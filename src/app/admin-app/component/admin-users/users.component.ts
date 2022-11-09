// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  EventEmitter,
  Output,
  NgZone,
  ViewChild,
  Input,
} from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatStepper } from '@angular/material/stepper';
import {
  UntypedFormControl,
  FormGroupDirective,
  NgForm,
  Validators,
} from '@angular/forms';
import { PermissionService, PermissionQuery } from '../../../permissions/state';
import { UserService, UserQuery } from '../../../users/state';
import {
  User,
  Permission,
  UserPermission,
} from '../../../generated/caster-api';
import { Subject, Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Component({
  selector: 'cas-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit {
  public matcher = new UserErrorStateMatcher();
  public isLinear = false;
  public users$: Observable<User[]>;
  public isLoading$: Observable<boolean>;
  public permissions$: Observable<Permission[]>;

  constructor(
    public zone: NgZone,
    private userService: UserService,
    private userQuery: UserQuery,
    private permissionQuery: PermissionQuery,
    private permissionService: PermissionService
  ) {}

  /**
   * Initialize component
   */
  ngOnInit() {
    this.users$ = this.userQuery.selectAll();
    this.userService.load().pipe(take(1)).subscribe();
    this.permissions$ = this.permissionQuery.selectAll();
    this.permissionService.load().pipe(take(1)).subscribe();
    this.isLoading$ =
      this.userQuery.selectLoading() || this.permissionQuery.selectLoading();
  }

  create(newUser: User) {
    this.userService.create(newUser).pipe(take(1)).subscribe();
  }

  delete(userId: string) {
    this.userService.delete(userId).pipe(take(1)).subscribe();
  }

  addUserPermission(userPermission: UserPermission) {
    this.userService.addUserPermission(
      userPermission.userId,
      userPermission.permissionId
    );
  }

  removeUserPermission(userPermission: UserPermission) {
    this.userService.removeUserPermission(
      userPermission.userId,
      userPermission.permissionId
    );
  }
} // End Class

/** Error when invalid control is dirty, touched, or submitted. */
export class UserErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}
