// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { DesignModulesComponent } from './design-modules.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  MatButtonModule,
  MatIconModule,
  MatCardModule,
  SharedModule,
];

async function renderDesignModules(
  overrides: {
    designId?: string;
    canEdit?: boolean;
  } = {}
) {
  return renderComponent(DesignModulesComponent, {
    declarations: [DesignModulesComponent],
    imports: sharedImports,
    componentProperties: {
      designId: overrides.designId ?? 'test-design-id',
      canEdit: overrides.canEdit ?? false,
    } as any,
  });
}

describe('DesignModulesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderDesignModules();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should accept designId input', async () => {
    const { fixture } = await renderDesignModules({
      designId: 'my-design-id',
    });
    expect(fixture.componentInstance.designId).toBe('my-design-id');
  });

  it('should show Modules heading', async () => {
    await renderDesignModules();
    expect(screen.getByText('Modules')).toBeInTheDocument();
  });

  it('should show Add Module button', async () => {
    await renderDesignModules();
    expect(screen.getByText('Add Module')).toBeInTheDocument();
  });

  it('should disable Add Module button when canEdit is false', async () => {
    await renderDesignModules({ canEdit: false });

    const btn = screen.getByText('Add Module').closest(
      'button'
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should enable Add Module button when canEdit is true', async () => {
    await renderDesignModules({ canEdit: true });

    const btn = screen.getByText('Add Module').closest(
      'button'
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});
