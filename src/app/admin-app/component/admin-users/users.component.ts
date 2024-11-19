// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Component, OnInit } from '@angular/core';
import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { UserService, UserQuery } from '../../../users/state';
import { User } from '../../../generated/caster-api';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

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

  constructor(private userService: UserService, private userQuery: UserQuery) {}

  /**
   * Initialize component
   */
  ngOnInit() {
    this.users$ = this.userQuery.selectAll();
    this.userService.load().pipe(take(1)).subscribe();
    this.isLoading$ = this.userQuery.selectLoading();
  }

  create(newUser: User) {
    this.userService.create(newUser).pipe(take(1)).subscribe();
  }

  deleteUser(userId: string) {
    this.userService.delete(userId).pipe(take(1)).subscribe();
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
