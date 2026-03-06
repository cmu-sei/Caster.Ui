// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { ModuleOutputsComponent } from './module-outputs.component';
import { ModuleOutputComponent } from './module-output/module-output.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ClipboardModule } from 'ngx-clipboard';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  MatIconModule,
  MatButtonModule,
  MatTooltipModule,
  MatSnackBarModule,
  ClipboardModule,
  SharedModule,
];

async function renderModuleOutputs(
  overrides: {
    moduleName?: string;
    outputs?: any[];
  } = {}
) {
  return renderComponent(ModuleOutputsComponent, {
    declarations: [ModuleOutputsComponent, ModuleOutputComponent],
    imports: sharedImports,
    componentProperties: {
      moduleName: overrides.moduleName ?? 'test_module',
      outputs: overrides.outputs ?? [],
    } as any,
  });
}

describe('OutputsComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderModuleOutputs();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show Outputs heading', async () => {
    await renderModuleOutputs();
    expect(screen.getByText('Outputs')).toBeInTheDocument();
  });

  it('should render output items', async () => {
    await renderModuleOutputs({
      outputs: [
        { name: 'vpc_id', value: '', description: '' },
        { name: 'subnet_id', value: '', description: '' },
      ],
    });

    expect(screen.getByText('vpc_id')).toBeInTheDocument();
    expect(screen.getByText('subnet_id')).toBeInTheDocument();
  });

  it('should render no output items when outputs is empty', async () => {
    const { container } = await renderModuleOutputs({ outputs: [] });

    expect(container.querySelectorAll('cas-module-output').length).toBe(0);
  });
});
