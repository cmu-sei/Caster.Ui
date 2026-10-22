// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import { User as OidcUser } from 'oidc-client-ts';
import { ComnAuthService, Theme } from '@cmusei/crucible-common';
import { User, UsersService } from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { recordEmissions } from '../../test-utils/record-emissions';
import { CurrentUserQuery, UserQuery } from './user.query';
import { UserService } from './user.service';
import { CurrentUserStore, initialUserUiState, UserStore } from './user.store';

function user(overrides: Partial<User> = {}): User {
  return { id: 'u1', name: 'Ada', roleId: null, ...overrides };
}

function oidcUser(sub: string, name: string): OidcUser {
  // Only `profile.sub` and `profile.name` are read by setCurrentUser.
  return { profile: { sub, name } } as OidcUser;
}

/**
 * Real UserStore, CurrentUserStore, both queries and UserService;
 * UsersService and ComnAuthService.user$ stubbed.
 */
function setup(api: ApiStub<UsersService> = {}, users: User[] = []) {
  const authUser$ = new Subject<OidcUser | null>();
  const auth: Pick<ComnAuthService, 'user$'> = { user$: authUser$ };
  TestBed.configureTestingModule({
    providers: getDefaultProviders([
      { provide: UsersService, useValue: api },
      { provide: ComnAuthService, useValue: auth },
    ]),
  });
  const store = TestBed.inject(UserStore);
  const query = TestBed.inject(UserQuery);
  const currentUser = TestBed.inject(CurrentUserQuery);
  const service = TestBed.inject(UserService);
  store.add(users);
  return { service, store, query, currentUser, authUser$ };
}

describe('UserService', () => {
  describe('load and loadById', () => {
    /**
     * Verifies: load turns loading on immediately, replaces the users with
     *   the API list and clears loading.
     * Interacts with: UsersService.getAllUsers (Subject stub).
     * Data: stored u9; the API returns u1 and u2.
     */
    it('load() replaces the users and toggles loading', () => {
      const response$ = new Subject<User[]>();
      const api = {
        getAllUsers: vi.fn(() => response$),
      } satisfies ApiStub<UsersService>;
      const { service, query } = setup(api, [user({ id: 'u9', name: 'Old' })]);

      const load$ = service.load();
      expect(query.getValue().loading).toBe(true);
      recordEmissions(load$);
      response$.next([user(), user({ id: 'u2', name: 'Bea' })]);

      expect(query.getAll().map((u) => u.id)).toEqual(['u1', 'u2']);
      expect(query.getValue().loading).toBe(false);
    });

    const boom = () => throwError(() => new Error('boom'));
    const failingLoads: {
      method: string;
      api: () => ApiStub<UsersService>;
      call: (s: UserService) => Observable<unknown>;
    }[] = [
      {
        method: 'load',
        api: () => ({ getAllUsers: vi.fn(boom) }),
        call: (s) => s.load(),
      },
      {
        method: 'loadById',
        api: () => ({ getUser: vi.fn(boom) }),
        call: (s) => s.loadById('u1'),
      },
    ];

    /**
     * Verifies: each loading-tracked load passes the error on and leaves
     *   loading on.
     * Interacts with: the row's UsersService method (throwError stub).
     * Data: stored u1 (loading false); the API errors with 'boom'.
     */
    it.each(failingLoads)(
      '$method() leaves loading on when the API fails',
      async ({ api, call }) => {
        const { service, query } = setup(api(), [user()]);

        const error = await firstValueFrom(call(service)).catch(
          (e: unknown) => e,
        );

        expect(error).toEqual(new Error('boom'));
        expect(query.getValue().loading).toBe(true);
      },
    );

    /**
     * Verifies: loadById upserts one user and clears loading.
     * Interacts with: UsersService.getUser (stub).
     * Data: stored u1; the API returns u1 with a role.
     */
    it('loadById() upserts the user', async () => {
      const api = {
        getUser: vi.fn(() => of(user({ roleId: 'r1' }))),
      } satisfies ApiStub<UsersService>;
      const { service, query } = setup(api, [user()]);

      await firstValueFrom(service.loadById('u1'));

      expect(api.getUser).toHaveBeenCalledWith('u1');
      expect(query.getEntity('u1').roleId).toBe('r1');
      expect(query.getValue().loading).toBe(false);
    });
  });

  describe('create, delete and editUser', () => {
    /**
     * Verifies: create posts the user and adds the response with default UI
     *   state.
     * Interacts with: UsersService.createUser (stub).
     * Data: new user Bea; the API returns u2.
     */
    it('create() adds the created user', async () => {
      const api = {
        createUser: vi.fn(() => of(user({ id: 'u2', name: 'Bea' }))),
      } satisfies ApiStub<UsersService>;
      const { service, query } = setup(api);

      await firstValueFrom(service.create(user({ id: 'u2', name: 'Bea' })));

      expect(api.createUser).toHaveBeenCalledWith(
        user({ id: 'u2', name: 'Bea' }),
      );
      expect(query.getEntity('u2').name).toBe('Bea');
      expect(query.ui.getEntity('u2')).toEqual({
        id: 'u2',
        ...initialUserUiState,
      });
    });

    /**
     * Verifies: delete removes the user and its UI state after the API
     *   succeeds.
     * Interacts with: UsersService.deleteUser (stub).
     * Data: stored u1 and u2; delete u1.
     */
    it('delete() removes the user', async () => {
      const api = {
        deleteUser: vi.fn(() => of(undefined)),
      } satisfies ApiStub<UsersService>;
      const { service, query } = setup(api, [
        user(),
        user({ id: 'u2', name: 'Bea' }),
      ]);

      await firstValueFrom(service.delete('u1'));

      expect(api.deleteUser).toHaveBeenCalledWith('u1');
      expect(query.getAll().map((u) => u.id)).toEqual(['u2']);
      expect(query.ui.hasEntity('u1')).toBe(false);
    });

    /**
     * Verifies: editUser sends the edit, but the stored user keeps its old
     *   values because the response is passed to add().
     * Interacts with: UsersService.editUser (stub); UserStore.add.
     * Data: stored u1 without a role; edit sets roleId r1 (as the admin
     *   user list's role picker does).
     */
    it('editUser() does not store the edited user', () => {
      const api = {
        editUser: vi.fn(() => of(user({ roleId: 'r1' }))),
      } satisfies ApiStub<UsersService>;
      const { service, query } = setup(api, [user()]);

      service.editUser(user({ roleId: 'r1' }));

      expect(api.editUser).toHaveBeenCalledWith('u1', user({ roleId: 'r1' }));
      expect(query.getEntity('u1').roleId).toBeNull();
    });
  });

  describe('current user', () => {
    /**
     * Verifies: setCurrentUser clears the name and id at once, then fills
     *   them from each signed-in user the auth service emits, ignoring null.
     * Interacts with: ComnAuthService.user$ (Subject stub); CurrentUserStore.
     * Data: a stored name; then user u1, null, and user u2.
     */
    it('setCurrentUser() follows the signed-in user', () => {
      const { service, currentUser, authUser$ } = setup();
      TestBed.inject(CurrentUserStore).update({ name: 'Previous', id: 'old' });

      service.setCurrentUser();
      expect(currentUser.getValue()).toMatchObject({ name: '', id: '' });

      authUser$.next(oidcUser('u1', 'Ada'));
      expect(currentUser.getValue()).toMatchObject({ name: 'Ada', id: 'u1' });

      authUser$.next(null);
      expect(currentUser.getValue()).toMatchObject({ name: 'Ada', id: 'u1' });

      authUser$.next(oidcUser('u2', 'Bea'));
      expect(currentUser.getValue()).toMatchObject({ name: 'Bea', id: 'u2' });
    });

    /**
     * Verifies: each setCurrentUser() call adds another user$ subscription, so one signed-in user emission updates the store once per earlier call (current behavior).
     * Interacts with: ComnAuthService.user$ (Subject stub); CurrentUserStore.update (spied).
     * Data: setCurrentUser() called twice, as two container pages do on init; then user u1 signs in once.
     */
    it('setCurrentUser() adds a user$ subscription on every call', () => {
      const { service, authUser$ } = setup();
      const update = vi.spyOn(TestBed.inject(CurrentUserStore), 'update');

      service.setCurrentUser();
      service.setCurrentUser();
      update.mockClear();
      authUser$.next(oidcUser('u1', 'Ada'));

      expect(update).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies: setUserTheme stores the theme for userTheme$.
     * Interacts with: CurrentUserStore.update; CurrentUserQuery.userTheme$.
     * Data: switch to the dark theme.
     */
    it('setUserTheme() switches the theme', () => {
      const { service, currentUser } = setup();
      const seen = recordEmissions(currentUser.userTheme$);

      service.setUserTheme(Theme.DARK);

      expect(seen).toEqual([Theme.LIGHT, Theme.DARK]);
    });

    /**
     * Verifies: setActive marks the user active in the entity and UI stores.
     * Interacts with: UserStore.setActive and UserStore.ui.setActive.
     * Data: stored u1.
     */
    it('setActive() activates the user in both stores', () => {
      const { service, query } = setup({}, [user()]);

      service.setActive('u1');

      expect(query.getValue().active).toBe('u1');
      expect(query.ui.getValue().active).toBe('u1');
    });
  });
});
