// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ClipboardModule } from 'ngx-clipboard';
import { VariablesComponent } from './variables.component';
import { VariableComponent } from './variable/variable.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VariablesQuery } from '../../state/variables/variables.query';
import { VariableService } from '../../state/variables/variables.service';
import { SharedModule } from 'src/app/shared/shared.module';

const mockVariables = [
  { id: 'v1', name: 'var_one', designId: 'd1', defaultValue: 'abc' },
  { id: 'v2', name: 'var_two', designId: 'd1', defaultValue: 'def' },
];

const sharedImports = [
  MatButtonModule,
  MatIconModule,
  MatCardModule,
  ClipboardModule,
  SharedModule,
];

function variablesQueryProvider(variables: any[]) {
  return {
    provide: VariablesQuery,
    useValue: {
      selectAll: () => of(variables),
      select: () => of(null),
      selectEntity: () => of(null),
      selectByDesignId: () => of(variables),
      getAll: () => variables,
      getEntity: () => null,
    },
  };
}

async function renderVariables(
  overrides: {
    designId?: string;
    canEdit?: boolean;
    variables?: any[];
    variableServiceOverride?: any;
  } = {}
) {
  const providers: any[] = [];

  if (overrides.variables !== undefined) {
    providers.push(variablesQueryProvider(overrides.variables));
  }

  if (overrides.variableServiceOverride) {
    providers.push({
      provide: VariableService,
      useValue: overrides.variableServiceOverride,
    });
  }

  return renderComponent(VariablesComponent, {
    declarations: [VariablesComponent, VariableComponent],
    imports: sharedImports,
    providers,
    componentProperties: {
      designId: overrides.designId ?? 'd1',
      canEdit: overrides.canEdit ?? true,
    } as any,
  });
}

describe('VariablesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderVariables();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show empty state message when no variables', async () => {
    await renderVariables({ variables: [], canEdit: true });

    expect(
      screen.getByText("This Design doesn't have any Variables yet.")
    ).toBeInTheDocument();
  });

  it('should render variable items when variables exist', async () => {
    const { container } = await renderVariables({
      variables: mockVariables,
      canEdit: true,
    });

    expect(container.querySelectorAll('cas-variable').length).toBe(2);
  });

  it('should disable Add button when canEdit is false', async () => {
    await renderVariables({ canEdit: false });

    const btn = screen.getByText('Add').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should enable Add button when canEdit is true', async () => {
    await renderVariables({ canEdit: true });

    const btn = screen.getByText('Add').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('should call variableService.create when Add is clicked', async () => {
    const createSpy = vi.fn().mockReturnValue(of({}));

    await renderVariables({
      canEdit: true,
      variableServiceOverride: {
        loadByDesignId: () => {},
        create: createSpy,
      },
    });

    const btn = screen.getByText('Add').closest('button') as HTMLButtonElement;
    await userEvent.click(btn);

    expect(createSpy).toHaveBeenCalledOnce();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ designId: 'd1', name: 'New Variable' })
    );
  });

  it('should show Add button even with empty variables list', async () => {
    await renderVariables({ variables: [], canEdit: true });

    const btn = screen.getByText('Add').closest('button') as HTMLButtonElement;
    expect(btn).toBeInTheDocument();
    expect(btn.disabled).toBe(false);
  });
});
