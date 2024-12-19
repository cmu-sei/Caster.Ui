import { inject, Injectable } from '@angular/core';
import { SystemRole, SystemRolesService } from '../generated/caster-api';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class RolesService {
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
        const roles = this.rolesSubject.getValue();
        let roleToUpdate = roles.find((x) => x.id == role.id);

        if (roleToUpdate != null) {
          Object.assign(roleToUpdate, role);
        }

        this.rolesSubject.next(roles);
      })
    );
  }

  createRole(role: SystemRole) {
    return this.roleService.createSystemRole(role).pipe(
      tap((x) => {
        const roles = this.rolesSubject.getValue();
        roles.push(x);
        this.rolesSubject.next(roles);
      })
    );
  }

  deleteRole(id: string) {
    return this.roleService.deleteSystemRole(id).pipe(
      tap((x) => {
        let roles = this.rolesSubject.getValue();
        roles = roles.filter((x) => x.id != id);
        this.rolesSubject.next(roles);
      })
    );
  }
}
