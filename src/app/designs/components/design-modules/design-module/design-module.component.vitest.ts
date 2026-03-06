// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { DesignModuleComponent } from './design-module.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  CommonModule,
  MatCardModule,
  MatIconModule,
  MatButtonModule,
  MatTooltipModule,
  SharedModule,
];

async function renderDesignModule(
  overrides: {
    designModule?: any;
    module?: any;
    canEdit?: boolean;
  } = {}
) {
  return renderComponent(DesignModuleComponent, {
    declarations: [DesignModuleComponent],
    imports: sharedImports,
    componentProperties: {
      designModule: overrides.designModule ?? {
        id: 'dm-1',
        name: 'test',
        moduleId: 'm-1',
        designId: 'd-1',
        enabled: true,
      },
      module: overrides.module,
      canEdit: overrides.canEdit ?? false,
    } as any,
  });
}

describe('DesignModuleComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderDesignModule();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display design module name', async () => {
    await renderDesignModule({
      designModule: {
        id: 'dm-1',
        name: 'my-module',
        moduleId: 'm-1',
        designId: 'd-1',
        enabled: true,
      },
    });

    expect(screen.getByText('my-module')).toBeInTheDocument();
  });

  it('should have Edit button', async () => {
    const { container } = await renderDesignModule();

    expect(
      container.querySelector('button[matTooltip="Edit"]')
    ).toBeInTheDocument();
  });

  it('should have Delete button', async () => {
    const { container } = await renderDesignModule();

    expect(
      container.querySelector('button[matTooltip="Delete"]')
    ).toBeInTheDocument();
  });

  it('should disable Delete when canEdit is false', async () => {
    const { container } = await renderDesignModule({ canEdit: false });

    const deleteBtn = container.querySelector(
      'button[matTooltip="Delete"]'
    ) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });
});
