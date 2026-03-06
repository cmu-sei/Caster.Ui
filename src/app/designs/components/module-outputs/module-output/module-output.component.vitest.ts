// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ClipboardModule } from 'ngx-clipboard';
import { ModuleOutputComponent } from './module-output.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  MatIconModule,
  MatButtonModule,
  MatTooltipModule,
  MatSnackBarModule,
  ClipboardModule,
  SharedModule,
];

async function renderModuleOutput(
  overrides: {
    output?: any;
    moduleName?: string;
  } = {}
) {
  return renderComponent(ModuleOutputComponent, {
    declarations: [ModuleOutputComponent],
    imports: sharedImports,
    componentProperties: {
      output: overrides.output ?? { name: 'test_output', value: '' },
      moduleName: overrides.moduleName ?? 'test_module',
    } as any,
  });
}

describe('ModuleOutputComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderModuleOutput();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display output name', async () => {
    await renderModuleOutput({
      output: { name: 'vpc_id', value: '', description: 'VPC identifier' },
    });

    expect(screen.getByText('vpc_id')).toBeInTheDocument();
  });

  it('should have copy button', async () => {
    const { container } = await renderModuleOutput();

    expect(
      container.querySelector('button[matTooltip="Copy Terraform"]')
    ).toBeInTheDocument();
  });

  it('should generate correct terraform reference', async () => {
    const { fixture } = await renderModuleOutput({
      output: { name: 'subnet_id', value: '' },
      moduleName: 'my_vpc',
    });

    expect(fixture.componentInstance.toTerraform()).toBe(
      '${module.my_vpc.subnet_id}'
    );
  });
});
