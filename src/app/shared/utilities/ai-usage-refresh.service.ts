// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, signal } from '@angular/core';

/**
 * Tells the project's AI usage panel that a call to a model was made, so it reads usage again. The panel is hidden until a
 * project has a call, so it cannot ask for a refresh by being opened.
 */
@Injectable({ providedIn: 'root' })
export class AiUsageRefreshService {
  private readonly count = signal(0);
  readonly calls = this.count.asReadonly();

  /** A request that may have used a model has finished, whether or not it answered. */
  called() {
    this.count.update((n) => n + 1);
  }
}
