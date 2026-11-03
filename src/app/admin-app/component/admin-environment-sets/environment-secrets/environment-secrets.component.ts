// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import {
  MatFormField,
  MatLabel,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import {
  EnvironmentSecrets,
  EnvironmentSet,
  EnvironmentSetValueSource,
} from 'src/app/generated/caster-api';

export interface SecretRow {
  name: string;
  available: boolean;
  usedBy: string[];
}

/**
 * Every secret name: those the API can supply (matching the patterns) and those entries
 * use, with whether each is available and which sets use it. Names only, never values.
 */
@Component({
  selector: 'cas-environment-secrets',
  templateUrl: './environment-secrets.component.html',
  styleUrls: ['./environment-secrets.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormField,
    MatLabel,
    MatSuffix,
    MatInput,
    MatIcon,
    MatIconButton,
  ],
})
export class EnvironmentSecretsComponent {
  readonly secrets = input<EnvironmentSecrets | null>(null);
  readonly sets = input<EnvironmentSet[] | null>(null);

  readonly filter = signal('');

  readonly rows = computed<SecretRow[]>(() => {
    const available = new Set(this.secrets()?.available ?? []);
    const usedBy = new Map<string, Set<string>>();

    for (const set of this.sets() ?? []) {
      for (const entry of set.entries ?? []) {
        if (
          entry.valueSource === EnvironmentSetValueSource.Secret &&
          entry.secretName
        ) {
          const names = usedBy.get(entry.secretName) ?? new Set<string>();
          names.add(set.name);
          usedBy.set(entry.secretName, names);
        }
      }
    }

    const names = new Set([
      ...available,
      ...(this.secrets()?.missing ?? []),
      ...usedBy.keys(),
    ]);
    const filter = this.filter().trim().toLowerCase();

    return (
      [...names]
        .map((name) => ({
          name,
          available: available.has(name),
          usedBy: [...(usedBy.get(name) ?? [])].sort((a, b) =>
            a.localeCompare(b),
          ),
        }))
        .filter(
          (row) =>
            !filter ||
            row.name.toLowerCase().includes(filter) ||
            row.usedBy.some((x) => x.toLowerCase().includes(filter)),
        )
        // Missing first: they are what needs attention.
        .sort(
          (a, b) =>
            Number(a.available) - Number(b.available) ||
            a.name.localeCompare(b.name),
        )
    );
  });
}
