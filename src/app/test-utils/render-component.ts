// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Type } from '@angular/core';
import { render, RenderComponentOptions } from '@testing-library/angular';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { getDefaultProviders } from './vitest-default-providers';

export async function renderComponent<T>(
  component: Type<T>,
  options?: Partial<RenderComponentOptions<T>>
) {
  const providers = getDefaultProviders(options?.providers as any);
  return render(component, {
    ...options,
    imports: [
      NoopAnimationsModule,
      RouterTestingModule,
      MatIconTestingModule,
      ...(options?.imports ?? []),
    ],
    providers,
  });
}
