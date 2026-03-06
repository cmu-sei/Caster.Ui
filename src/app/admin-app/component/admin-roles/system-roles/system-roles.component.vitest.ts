// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { SystemRolesComponent } from './system-roles.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';

describe('SystemRolesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(SystemRolesComponent, {
      declarations: [SystemRolesComponent],
      imports: [MatTableModule, MatCheckboxModule, MatDialogModule],
      providers: [
        {
          provide: SignalRService,
          useValue: {
            startConnection: () => Promise.resolve(),
            joinRolesAdmin: () => {},
            leaveRolesAdmin: () => {},
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
