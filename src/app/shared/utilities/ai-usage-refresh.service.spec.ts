// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AiUsageRefreshService } from './ai-usage-refresh.service';

describe('AiUsageRefreshService', () => {
  it('counts each finished call so a watcher reads usage again', () => {
    const service = new AiUsageRefreshService();

    service.called();
    service.called();

    expect(service.calls()).toBe(2);
  });
});
