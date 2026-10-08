// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatTabsModule } from '@angular/material/tabs';
import { renderComponent } from '../../../test-utils/render-component';
import { AdminRolesComponent } from './admin-roles.component';

@Component({ selector: 'cas-system-roles', template: '', standalone: false })
class SystemRolesStub {}

@Component({ selector: 'cas-project-roles', template: '', standalone: false })
class ProjectRolesStub {}

describe('AdminRolesComponent', () => {
  /**
   * Verifies: the page opens on the system Roles tab and shows the project roles once the Project Roles tab is chosen.
   * Interacts with: the cas-system-roles and cas-project-roles stubs inside lazy mat-tab content.
   * Data: no inputs; the Project Roles tab clicked.
   */
  it('switches between the system and project roles', async () => {
    const { fixture } = await renderComponent(AdminRolesComponent, {
      declarations: [SystemRolesStub, ProjectRolesStub],
      imports: [MatTabsModule],
    });

    expect(screen.getByRole('tab', { name: 'Roles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      fixture.debugElement.query(By.directive(SystemRolesStub)),
    ).not.toBeNull();
    expect(
      fixture.debugElement.query(By.directive(ProjectRolesStub)),
    ).toBeNull();

    await userEvent
      .setup()
      .click(screen.getByRole('tab', { name: 'Project Roles' }));
    await fixture.whenStable();

    expect(
      fixture.debugElement.query(By.directive(ProjectRolesStub)),
    ).not.toBeNull();
  });
});
