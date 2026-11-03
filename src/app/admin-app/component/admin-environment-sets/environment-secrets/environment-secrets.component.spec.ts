// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { renderComponent } from 'src/app/test-utils/render-component';
import { EnvironmentSecretsComponent } from './environment-secrets.component';

describe('EnvironmentSecretsComponent', () => {
  /**
   * Verifies: missing secrets are listed first, and the search matches names and set names.
   * Interacts with: the secrets and sets inputs; the Search input.
   * Data: an available unused name and a missing one used by vSphere.
   */
  it('lists missing secrets first and searches', async () => {
    await renderComponent(EnvironmentSecretsComponent, {
      inputs: {
        secrets: {
          available: ['CASTER_SECRET_A'],
          missing: ['CASTER_SECRET_B'],
          patterns: ['^CASTER_SECRET_'],
          runMode: 'Process',
          inheritAll: false,
        },
        sets: [
          {
            id: 's1',
            name: 'vSphere',
            entries: [
              {
                id: 'e1',
                targetName: 'VSPHERE_PASSWORD',
                valueSource: 'Secret',
                secretName: 'CASTER_SECRET_B',
              },
            ],
          },
        ],
      },
    });

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('CASTER_SECRET_B');
    expect(rows[0]).toHaveTextContent('Missing');
    expect(rows[0]).toHaveTextContent('vSphere');
    expect(rows[1]).toHaveTextContent('Not used');

    await userEvent.setup().type(screen.getByLabelText('Search'), 'vsphere');

    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
});
