// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { VlansComponent } from './vlans.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';

describe('VlansComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(VlansComponent, {
      declarations: [VlansComponent],
      providers: [
        {
          provide: SignalRService,
          useValue: {
            startConnection: () => Promise.resolve(),
            joinVlansAdmin: () => {},
            leaveVlansAdmin: () => {},
            joinProject: () => {},
            leaveProject: () => {},
            joinWorkspace: () => {},
            leaveWorkspace: () => {},
          },
        },
      ],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});
