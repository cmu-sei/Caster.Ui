// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { DesignComponent } from './design.component';
import { DesignModulesComponent } from '../design-modules/design-modules.component';
import { VariablesComponent } from '../variables/variables.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  MatExpansionModule,
  MatTooltipModule,
  MatButtonModule,
  MatIconModule,
  MatCardModule,
  SharedModule,
];

async function renderDesign(
  overrides: {
    designId?: string;
    canEdit?: boolean;
  } = {}
) {
  return renderComponent(DesignComponent, {
    declarations: [DesignComponent, DesignModulesComponent, VariablesComponent],
    imports: sharedImports,
    providers: [
      {
        provide: SignalRService,
        useValue: {
          startConnection: () => Promise.resolve(),
          joinProject: () => {},
          leaveProject: () => {},
          joinWorkspace: () => {},
          leaveWorkspace: () => {},
          joinDesign: () => {},
          leaveDesign: () => {},
        },
      },
    ],
    componentProperties: {
      designId: overrides.designId ?? 'test-design-id',
      canEdit: overrides.canEdit ?? false,
    } as any,
  });
}

describe('DesignComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderDesign();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should accept designId input', async () => {
    const { fixture } = await renderDesign({ designId: 'my-design-123' });
    expect(fixture.componentInstance.designId).toBe('my-design-123');
  });

  it('should render Variables expansion panel', async () => {
    await renderDesign();
    expect(screen.getByText('Variables')).toBeInTheDocument();
  });

  it('should render Modules heading', async () => {
    await renderDesign();
    expect(screen.getByText('Modules')).toBeInTheDocument();
  });
});
