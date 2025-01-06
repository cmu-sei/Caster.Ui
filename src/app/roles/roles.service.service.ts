/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { inject, Injectable } from '@angular/core';
import { SystemRole, SystemRolesService } from '../generated/caster-api';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private roleService = inject(SystemRolesService);

  rolesSubject = new BehaviorSubject<SystemRole[]>([]);
  roles$ = this.rolesSubject.asObservable();

  getRoles() {
    return this.roleService
      .getAllSystemRoles()
      .pipe(tap((x) => this.rolesSubject.next(x)));
  }

  editRole(role: SystemRole) {
    return this.roleService.editSystemRole(role.id, role).pipe(
      tap((x) => {
        this.upsert(role.id, x);
      })
    );
  }

  createRole(role: SystemRole) {
    return this.roleService.createSystemRole(role).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  deleteRole(id: string) {
    return this.roleService.deleteSystemRole(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  upsert(id: string, role: Partial<SystemRole>) {
    const roles = this.rolesSubject.getValue();
    let roleToUpdate = roles.find((x) => x.id === id);

    if (roleToUpdate != null) {
      Object.assign(roleToUpdate, role);
    } else {
      roles.push({ ...role, id } as SystemRole);
    }

    this.rolesSubject.next(roles);
  }

  remove(id: string) {
    let roles = this.rolesSubject.getValue();
    roles = roles.filter((x) => x.id != id);
    this.rolesSubject.next(roles);
  }
}
