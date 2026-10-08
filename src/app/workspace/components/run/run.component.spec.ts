// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IStreamResult, IStreamSubscriber } from '@microsoft/signalr';
import { Run, RunStatus } from 'src/app/generated/caster-api';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { mockMatchMedia } from 'src/app/test-utils/match-media';
import { renderComponent } from 'src/app/test-utils/render-component';
import { RunComponent } from './run.component';

/** A hub stream that sends the given chunks, then completes. */
function streamOf(chunks: string[]): IStreamResult<string> {
  return {
    subscribe: (subscriber: IStreamSubscriber<string>) => {
      chunks.forEach((c) => subscriber.next(c));
      subscriber.complete();
      return { dispose: vi.fn() };
    },
  };
}

async function renderRun(run: Run) {
  mockMatchMedia();
  const signalR = {
    startConnection: vi.fn(() => Promise.resolve()),
    streamPlanOutput: vi.fn((_planId: string) =>
      streamOf(['Plan: ', '1 to add']),
    ),
    streamApplyOutput: vi.fn((_applyId: string) => streamOf([])),
  } satisfies Pick<
    SignalRService,
    'startConnection' | 'streamPlanOutput' | 'streamApplyOutput'
  >;
  const planOutput = vi.fn<(output: string) => void>();
  const view = await renderComponent(RunComponent, {
    imports: [DragDropModule, MatIconModule, MatTooltipModule, MatButtonModule],
    providers: [{ provide: SignalRService, useValue: signalR }],
    inputs: { run, loading: false },
    on: { planOutput },
  });
  await view.fixture.whenStable();
  const firstLine = () =>
    view.fixture.componentInstance.xterm.buffer.active
      .getLine(0)
      ?.translateToString(true);
  return { ...view, signalR, planOutput, firstLine };
}

describe('RunComponent', () => {
  /**
   * Verifies: a planned run with its plan loaded writes the plan output without streaming.
   * Interacts with: the real xterm Terminal (with mockMatchMedia), SignalRService (stub, not streamed).
   * Data: run Planned with plan output "Plan: 2 to add".
   */
  it('shows the stored plan output', async () => {
    const { signalR, firstLine } = await renderRun({
      id: 'run1',
      status: RunStatus.Planned,
      planId: 'pl1',
      applyId: null,
      plan: { id: 'pl1', output: 'Plan: 2 to add' },
    });

    expect(firstLine()).toBe('Plan: 2 to add');
    expect(signalR.streamPlanOutput).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a planning run without stored output streams the plan from the hub and emits the full output when the stream completes.
   * Interacts with: SignalRService.startConnection and streamPlanOutput (stub), the planOutput output.
   * Data: run Planning, plan not loaded; stream chunks "Plan: " and "1 to add".
   */
  it('streams the plan output of a planning run', async () => {
    const { signalR, planOutput, firstLine } = await renderRun({
      id: 'run1',
      status: RunStatus.Planning,
      planId: 'pl1',
      applyId: null,
    });

    expect(signalR.streamPlanOutput).toHaveBeenCalledWith('pl1');
    expect(planOutput).toHaveBeenCalledWith('Plan: 1 to add');
    expect(firstLine()).toBe('Plan: 1 to add');
  });
});
