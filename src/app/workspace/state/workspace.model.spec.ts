// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { RunStatus } from '../../generated/caster-api';
import { createRun, createWorkspace, ResourceActions } from './workspace.model';

describe('workspace.model', () => {
  describe('createRun', () => {
    /**
     * Verifies: copies the run fields and derives planId/applyId from the
     *   nested plan and apply.
     * Interacts with: createRun (pure).
     * Data: a run with id, status, plan p1 and apply a1.
     */
    it('derives planId and applyId from the nested plan and apply', () => {
      const result = createRun({
        id: 'r1',
        workspaceId: 'w1',
        createdAt: '2026-01-01T00:00:00Z',
        isDestroy: true,
        status: RunStatus.Applied,
        plan: { id: 'p1', output: 'plan' },
        apply: { id: 'a1', output: 'apply' },
      });

      expect(result).toEqual({
        id: 'r1',
        workspaceId: 'w1',
        createdAt: '2026-01-01T00:00:00Z',
        isDestroy: true,
        status: RunStatus.Applied,
        planId: 'p1',
        applyId: 'a1',
        plan: { id: 'p1', output: 'plan' },
        apply: { id: 'a1', output: 'apply' },
      });
    });

    /**
     * Verifies: a run without an id, plan or apply gets a null id, null
     *   planId/applyId and empty plan/apply objects.
     * Interacts with: createRun (pure).
     * Data: only workspaceId; then an empty-string id.
     */
    it('defaults the id, plan and apply of a new run', () => {
      expect(createRun({ workspaceId: 'w1' })).toEqual({
        id: null,
        workspaceId: 'w1',
        createdAt: undefined,
        isDestroy: undefined,
        status: undefined,
        planId: null,
        applyId: null,
        plan: {},
        apply: {},
      });
      expect(createRun({ id: '' }).id).toBeNull();
    });
  });

  describe('createWorkspace', () => {
    /**
     * Verifies: a new workspace gets a null id, dynamicHost false and empty
     *   runs and resources arrays, and no other fields.
     * Interacts with: createWorkspace (pure).
     * Data: only name and directoryId.
     */
    it('fills the defaults for a new workspace', () => {
      expect(createWorkspace({ name: 'Alpha', directoryId: 'd1' })).toEqual({
        id: null,
        name: 'Alpha',
        directoryId: 'd1',
        dynamicHost: false,
        runs: [],
        resources: [],
      });
    });

    /**
     * Verifies: given values are kept, and fields createWorkspace does not
     *   list (terraformVersion) are dropped.
     * Interacts with: createWorkspace (pure).
     * Data: a workspace with id, dynamicHost, runs, resources and
     *   terraformVersion.
     */
    it('keeps given values and drops unlisted fields', () => {
      const result = createWorkspace({
        id: 'w1',
        name: 'Alpha',
        directoryId: 'd1',
        dynamicHost: true,
        runs: [{ id: 'r1' }],
        resources: [{ address: 'aws_instance.a' }],
        terraformVersion: '1.9.0',
      });

      expect(result).toEqual({
        id: 'w1',
        name: 'Alpha',
        directoryId: 'd1',
        dynamicHost: true,
        runs: [{ id: 'r1' }],
        resources: [{ address: 'aws_instance.a' }],
      });
      expect(result).not.toHaveProperty('terraformVersion');
    });
  });

  describe('ResourceActions', () => {
    /**
     * Verifies: the numeric values of ResourceActions, with None as the falsy
     *   default the UI uses for "no action in progress".
     * Interacts with: ResourceActions enum.
     * Data: the enum.
     */
    it('uses None = 0 as the idle action', () => {
      expect(ResourceActions.None).toBe(0);
      expect([
        ResourceActions.Taint,
        ResourceActions.Remove,
        ResourceActions.Refresh,
      ]).toEqual([1, 2, 3]);
    });
  });
});
