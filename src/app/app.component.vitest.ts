// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AppComponent } from './app.component';
import { renderComponent } from './test-utils/render-component';
import { CurrentUserStore } from './users/state';
import { HotkeysService } from '@ngneat/hotkeys';
import { of } from 'rxjs';

describe('AppComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(AppComponent, {
      declarations: [AppComponent],
      providers: [
        {
          provide: CurrentUserStore,
          useValue: { update: () => {} },
        },
        {
          provide: HotkeysService,
          useValue: {
            registerHelpModal: () => {},
            addShortcut: () => of(),
          },
        },
      ],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
