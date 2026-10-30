// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Observable, of, throwError } from 'rxjs';
import { ProjectAiUsage, ProjectsService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectAiUsageComponent } from './project-ai-usage.component';

const USAGE: ProjectAiUsage = {
  projectId: 'p1',
  name: 'Range',
  calls: 3,
  refused: 1,
  inputTokens: 48565,
  outputTokens: 43573,
  estimatedCostMicros: 537360,
  unpriced: [],
  byTask: [
    {
      name: 'design',
      calls: 1,
      inputTokens: 2000,
      outputTokens: 3000,
      estimatedCostMicros: 38500,
    },
    {
      name: 'terraform',
      calls: 2,
      refused: 1,
      inputTokens: 46565,
      outputTokens: 40573,
      estimatedCostMicros: 498860,
    },
  ],
};

async function renderUsage(
  answer: (projectId: string) => Observable<ProjectAiUsage>,
  inputs: { projectId: string | undefined } = { projectId: 'p1' },
) {
  const projectsApi = {
    getProjectAiUsage: vi.fn(answer),
  } satisfies ApiStub<ProjectsService>;
  const rendered = await renderComponent(ProjectAiUsageComponent, {
    providers: [{ provide: ProjectsService, useValue: projectsApi }],
    inputs,
  });
  return { ...rendered, projectsApi };
}

describe('ProjectAiUsageComponent', () => {
  /**
   * Verifies: the project's AI calls show by task in the menu's words, with tokens and each task's cost in dollars, and the total and refusals in a line above.
   * Interacts with: ProjectsService.getProjectAiUsage.
   * Data: one design draft and two Terraform drafts (one refused), $0.54 in all.
   */
  it('shows what drafting with AI used in the project, by task', async () => {
    const user = userEvent.setup();
    const { projectsApi } = await renderUsage(() => of(USAGE));

    expect(projectsApi.getProjectAiUsage).toHaveBeenCalledWith('p1');
    await user.click(screen.getByRole('button', { name: /AI USAGE/ }));

    expect(
      screen.getByText(
        /3 calls to AI models drafted for this project, about \$0\.54 at list prices\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 was declined by the model's safety checks/),
    ).toBeInTheDocument();
    const terraform = screen.getByRole('row', {
      name: /Draft or edit Terraform with AI/,
    });
    expect(within(terraform).getByText('46,565')).toBeInTheDocument();
    expect(within(terraform).getByText('$0.50')).toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /Draft Design with AI/ }),
    ).toHaveTextContent('$0.04');
    expect(screen.getByRole('row', { name: /Total/ })).toHaveTextContent(
      '$0.54',
    );
  });

  /**
   * Verifies: opening the panel reads the usage again, so a draft made since it loaded shows.
   * Interacts with: ProjectsService.getProjectAiUsage.
   * Data: three calls when the page opens, four by the time the panel is opened.
   */
  it('reads the usage again when opened', async () => {
    const user = userEvent.setup();
    let calls = 3;
    const { projectsApi } = await renderUsage(() =>
      of({ ...USAGE, calls: calls++ }),
    );

    await user.click(screen.getByRole('button', { name: /AI USAGE/ }));

    expect(projectsApi.getProjectAiUsage).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/4 calls to AI models/)).toBeInTheDocument();
  });

  /**
   * Verifies: a model with no price is left out of the total, which still shows for the rest, and is named so it can be priced.
   * Interacts with: ProjectsService.getProjectAiUsage.
   * Data: the usage above with a local model unpriced; the rest comes to $0.54.
   */
  it('totals what has a price and names what has none', async () => {
    const user = userEvent.setup();
    await renderUsage(() =>
      of({ ...USAGE, refused: 0, unpriced: ['local-model'] }),
    );
    await user.click(screen.getByRole('button', { name: /AI USAGE/ }));

    expect(
      screen.getByText(/about \$0\.54 at list prices/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The estimate leaves out local-model, which has no price set\. Add one under Ai:Prices on the Caster API\./,
      ),
    ).toBeInTheDocument();
  });

  /**
   * Verifies: when no model has a price there is no estimate at all, and a cost under a cent reads as such.
   * Interacts with: ProjectsService.getProjectAiUsage.
   * Data: the brief call unpriced; a design call that cost $0.006.
   */
  it('shows no estimate when nothing has a price', async () => {
    const user = userEvent.setup();
    await renderUsage(() =>
      of({
        ...USAGE,
        refused: 0,
        estimatedCostMicros: null,
        unpriced: ['local-model'],
        byTask: [
          {
            name: 'brief',
            calls: 1,
            inputTokens: 10,
            outputTokens: 10,
            estimatedCostMicros: null,
          },
          {
            name: 'design',
            calls: 1,
            inputTokens: 10,
            outputTokens: 10,
            estimatedCostMicros: 6000,
          },
        ],
      }),
    );
    await user.click(screen.getByRole('button', { name: /AI USAGE/ }));

    expect(screen.queryByText(/at list prices/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /Terraform from a scenario brief/ }),
    ).not.toHaveTextContent('$');
    expect(
      screen.getByRole('row', { name: /Draft Design with AI/ }),
    ).toHaveTextContent('under $0.01');
  });

  /**
   * Verifies: a project drafted without AI, or one whose usage the user may not read, shows nothing.
   * Interacts with: ProjectsService.getProjectAiUsage answering no calls, then a 403.
   * Data: zero calls; a refused request.
   */
  it.each([
    { label: 'drafted without AI', answer: () => of({ calls: 0, byTask: [] }) },
    {
      label: 'whose usage the user may not read',
      answer: () => throwError(() => ({ status: 403 })),
    },
  ])('shows nothing for a project $label', async ({ answer }) => {
    await renderUsage(answer);

    expect(
      screen.queryByRole('button', { name: /AI USAGE/ }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: the panel asks for nothing until it has a project, then asks for that project's usage, and drops what it showed for the last one.
   * Interacts with: ProjectsService.getProjectAiUsage.
   * Data: no project at first, then p1, then p2 with no calls.
   */
  it('follows the project it is given', async () => {
    const { fixture, projectsApi } = await renderUsage(
      (id) => of(id === 'p1' ? USAGE : { calls: 0, byTask: [] }),
      { projectId: undefined },
    );
    expect(projectsApi.getProjectAiUsage).not.toHaveBeenCalled();

    fixture.componentRef.setInput('projectId', 'p1');
    fixture.detectChanges();
    expect(projectsApi.getProjectAiUsage).toHaveBeenCalledWith('p1');
    expect(
      screen.getByRole('button', { name: /AI USAGE/ }),
    ).toBeInTheDocument();

    fixture.componentRef.setInput('projectId', 'p2');
    fixture.detectChanges();
    expect(projectsApi.getProjectAiUsage).toHaveBeenCalledWith('p2');
    expect(
      screen.queryByRole('button', { name: /AI USAGE/ }),
    ).not.toBeInTheDocument();
  });
});
