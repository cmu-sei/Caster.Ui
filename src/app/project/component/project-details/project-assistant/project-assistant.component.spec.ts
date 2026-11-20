// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpErrorResponse } from '@angular/common/http';
import { Theme } from '@cmusei/crucible-common';
import { DiffEditorComponent, EditorComponent } from 'ngx-monaco-editor-v2';
import { BehaviorSubject, of, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AiAssistResult,
  AiAssistService,
  Directory,
  Workspace,
  WorkspacesService,
} from 'src/app/generated/caster-api';
import { DirectoryQuery } from 'src/app/directories/state';
import { FileService } from 'src/app/files/state';
import { WorkspaceQuery, WorkspaceService } from 'src/app/workspace/state';
import { CurrentUserQuery } from 'src/app/users/state';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectAssistantComponent } from './project-assistant.component';

interface EditorOptionsStub {
  theme?: string;
}
interface EditorModelStub {
  code?: string;
  value?: string;
  language?: string;
}

// Monaco cannot load in jsdom; the stubs keep what each editor is given. Their selectors are
// the library's, not the app's.
// eslint-disable-next-line @angular-eslint/component-selector
@Component({ selector: 'ngx-monaco-diff-editor', template: '' })
class DiffEditorStub {
  readonly options = input<EditorOptionsStub>();
  readonly originalModel = input<EditorModelStub>();
  readonly modifiedModel = input<EditorModelStub>();
}
// eslint-disable-next-line @angular-eslint/component-selector
@Component({ selector: 'ngx-monaco-editor', template: '' })
class EditorStub {
  readonly options = input<EditorOptionsStub>();
  readonly model = input<EditorModelStub>();
}

// the project page holds the panel in an OnPush view, below the root
@Component({
  selector: 'cas-on-push-parent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectAssistantComponent],
  template:
    '<cas-project-assistant projectId="p1" directoryId="lab" workspaceId="dev" />',
})
class OnPushParent {}
@Component({
  selector: 'cas-on-push-host',
  imports: [OnPushParent],
  template: '<cas-on-push-parent />',
})
class OnPushHost {}

const DIRECTORIES: Directory[] = [
  { id: 'range', name: 'range', projectId: 'p1' },
  { id: 'lab', name: 'lab', projectId: 'p1', parentId: 'range' },
  { id: 'other-project', name: 'elsewhere', projectId: 'p2' },
];
const WORKSPACES: Workspace[] = [
  { id: 'dev', name: 'dev', directoryId: 'lab', runs: [] },
  { id: 'prod', name: 'prod', directoryId: 'lab', runs: [] },
];

// a failed plan under Terraform 0.12: main.tf fixed, a new variables file, and dev moved to 1.5.7
const ANSWER: AiAssistResult = {
  reply:
    'count in a module block needs Terraform 0.13 or later; dev runs 0.12.29.',
  cause: 'environment',
  changes: [
    {
      op: 'file.edit',
      label: 'Edit main.tf',
      fileId: 'main',
      fileName: 'main.tf',
      content: 'module "web" {}\n',
      existingContent: '# old\n',
      existingContentHash: 'HASH',
    },
    {
      op: 'file.add',
      label: 'Add variables.tf',
      fileName: 'variables.tf',
      content: 'variable "x" {}\n',
    },
    {
      op: 'workspace.version',
      label: 'Set dev to Terraform 1.5.7 (now 0.12.29)',
      workspaceId: 'dev',
      workspaceName: 'dev',
      terraformVersion: '1.5.7',
      existingTerraformVersion: '0.12.29',
    },
  ],
  warnings: [
    'Edit provider.tf: left out, provider.tf belongs to the parent directory range.',
  ],
};

async function renderPanel(
  api: Partial<
    Record<'askAiAssistant' | 'applyAiAssistantChanges', unknown>
  > = {},
  inputs: { projectId: string; directoryId?: string; workspaceId?: string } = {
    projectId: 'p1',
    directoryId: 'lab',
    workspaceId: 'dev',
  },
) {
  const defaultApi = {
    askAiAssistant: vi.fn(() => of(structuredClone(ANSWER))),
    applyAiAssistantChanges: vi.fn(() =>
      of({
        results: [
          {
            op: 'file.edit',
            label: 'Edit main.tf',
            applied: true,
            fileId: 'main',
          },
          {
            op: 'workspace.version',
            label: 'Set dev to Terraform 1.5.7 (now 0.12.29)',
            applied: false,
            error:
              "dev's Terraform version has changed since this was proposed. Ask again.",
            workspaceId: 'dev',
          },
        ],
      }),
    ),
  } satisfies ApiStub<AiAssistService>;
  // a test's own stub keeps the default's type, so its calls stay typed
  const assistApi = { ...defaultApi, ...(api as Partial<typeof defaultApi>) };
  const workspacesApi = {
    getWorkspace: vi.fn((id: string) =>
      of({ id, name: id, terraformVersion: '1.5.7', runs: [] }),
    ),
  } satisfies ApiStub<WorkspacesService>;
  const fileService = {
    refreshFile: vi.fn(() => of({})),
    loadFilesByDirectory: vi.fn(() => of([])),
  };
  const workspaceService = { updated: vi.fn() };
  const view = await renderComponent(ProjectAssistantComponent, {
    childStubs: [
      { replace: DiffEditorComponent, with: DiffEditorStub },
      { replace: EditorComponent, with: EditorStub },
    ],
    providers: [
      { provide: AiAssistService, useValue: assistApi },
      { provide: WorkspacesService, useValue: workspacesApi },
      {
        provide: DirectoryQuery,
        useValue: { selectAll: () => of(DIRECTORIES) },
      },
      {
        provide: WorkspaceQuery,
        useValue: { selectAll: () => of(WORKSPACES) },
      },
      { provide: FileService, useValue: fileService },
      { provide: WorkspaceService, useValue: workspaceService },
      {
        provide: CurrentUserQuery,
        useValue: { userTheme$: new BehaviorSubject<Theme>(Theme.LIGHT) },
      },
    ],
    inputs,
  });
  return {
    ...view,
    assistApi,
    workspacesApi,
    fileService,
    workspaceService,
    user: userEvent.setup(),
  };
}

async function ask(
  user: ReturnType<typeof userEvent.setup>,
  text = 'fix the errors from the last apply',
) {
  await user.type(
    screen.getByRole('textbox', { name: 'What should change?' }),
    text,
  );
  await user.click(screen.getByRole('button', { name: 'Ask' }));
}

describe('ProjectAssistantComponent', () => {
  /**
   * Verifies: the panel starts on the open tab's directory and workspace, sends the request with them, and shows the reply,
   * that the cause is not the code, each labelled change kept, and what was left out.
   * Interacts with: AiAssistService.askAiAssistant.
   * Data: the lab directory's dev workspace open; an answer of three changes and one warning.
   */
  it('asks for the open directory and shows the proposed changes', async () => {
    const { assistApi, user } = await renderPanel();

    expect(
      screen.getByText('Fix the errors from the last plan or apply'),
    ).toBeInTheDocument();
    await ask(user);

    expect(assistApi.askAiAssistant).toHaveBeenCalledWith('lab', {
      prompt: 'fix the errors from the last apply',
      workspaceId: 'dev',
      history: [],
    });
    expect(
      screen.getByText(/count in a module block needs Terraform 0\.13/),
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Not a code problem');
    const changes = within(
      screen.getByRole('list', { name: 'Proposed changes' }),
    );
    for (const label of [
      'Edit main.tf',
      'Add variables.tf',
      'Set dev to Terraform 1.5.7 (now 0.12.29)',
    ]) {
      expect(changes.getByRole('checkbox', { name: label })).toBeChecked();
    }
    expect(
      screen.getByText(/provider\.tf belongs to the parent directory range/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Apply 3 changes' }),
    ).toBeEnabled();
    // the directory is shown by its path
    expect(
      screen.getByRole('combobox', { name: 'Directory' }),
    ).toHaveTextContent('range / lab');
  });

  /**
   * Verifies: an edited file shows as a diff of the content it was proposed against and the new content, and a new file
   * on its own.
   * Interacts with: the diff and editor stubs.
   * Data: main.tf replacing "# old"; a new variables.tf.
   */
  it('shows each file change as a diff before it is applied', async () => {
    const { fixture, user } = await renderPanel();
    await ask(user);

    await user.click(screen.getByRole('button', { name: 'Show changes' }));
    await user.click(screen.getByRole('button', { name: 'Show file' }));

    const diff = fixture.debugElement.query(By.directive(DiffEditorStub))
      .componentInstance as DiffEditorStub;
    expect(diff.originalModel()).toEqual({ code: '# old\n', language: 'hcl' });
    expect(diff.modifiedModel()).toEqual({
      code: 'module "web" {}\n',
      language: 'hcl',
    });
    const editor = fixture.debugElement.query(By.directive(EditorStub))
      .componentInstance as EditorStub;
    expect(editor.model()).toEqual({
      value: 'variable "x" {}\n',
      language: 'hcl',
    });
  });

  /**
   * Verifies: a change to a workspace's own file shows as a diff like a directory file's, and applying it reloads that file.
   * Interacts with: AiAssistService.applyAiAssistantChanges, FileService.refreshFile, the diff stub.
   * Data: dev's variables.auto.tfvars, workstations 2 to 4.
   */
  it('shows a workspace file change as a diff and reloads the file when it is applied', async () => {
    const workspaceFileAnswer: AiAssistResult = {
      reply: 'Raised the workstation count.',
      cause: 'none',
      changes: [
        {
          op: 'workspace.file.edit',
          label: 'Edit variables.auto.tfvars in dev',
          fileId: 'vars',
          fileName: 'variables.auto.tfvars',
          workspaceId: 'dev',
          workspaceName: 'dev',
          content: 'workstations = 4\n',
          existingContent: 'workstations = 2\n',
          existingContentHash: 'HASH',
        },
      ],
    };
    const { fixture, assistApi, fileService, user } = await renderPanel({
      askAiAssistant: vi.fn(() => of(structuredClone(workspaceFileAnswer))),
      applyAiAssistantChanges: vi.fn(() =>
        of({
          results: [
            {
              op: 'workspace.file.edit',
              label: 'Edit variables.auto.tfvars in dev',
              applied: true,
              fileId: 'vars',
              workspaceId: 'dev',
            },
          ],
        }),
      ),
    });
    await ask(user, 'raise the workstations to 4');

    // a lone file change opens as a diff of itself
    const diff = fixture.debugElement.query(By.directive(DiffEditorStub))
      .componentInstance as DiffEditorStub;
    expect(diff.originalModel()?.code).toBe('workstations = 2\n');
    expect(diff.modifiedModel()?.code).toBe('workstations = 4\n');

    await user.click(screen.getByRole('button', { name: 'Apply 1 change' }));

    expect(assistApi.applyAiAssistantChanges).toHaveBeenCalledTimes(1);
    expect(fileService.refreshFile).toHaveBeenCalledWith('vars');
  });

  /**
   * Verifies: Apply sends only the kept changes, shows what came of each, and reloads the file and workspace they touched,
   * leaving an open file's unsaved edits alone.
   * Interacts with: AiAssistService.applyAiAssistantChanges, FileService.refreshFile, WorkspacesService.getWorkspace.
   * Data: the new file left out; main.tf applied; the version change refused as stale.
   */
  it('applies the kept changes and shows the result of each', async () => {
    const { assistApi, fileService, workspacesApi, user } = await renderPanel();
    await ask(user);

    await user.click(
      screen.getByRole('checkbox', { name: 'Add variables.tf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Apply 2 changes' }));

    const sent = assistApi.applyAiAssistantChanges.mock.calls[0] as unknown as [
      string,
      { changes: { label: string }[] },
    ];
    expect(sent[0]).toBe('lab');
    expect(sent[1].changes.map((c) => c.label)).toEqual([
      'Edit main.tf',
      'Set dev to Terraform 1.5.7 (now 0.12.29)',
    ]);
    const results = within(screen.getByRole('list', { name: 'Results' }));
    expect(results.getByText('Edit main.tf')).toBeInTheDocument();
    expect(
      results.getByText(
        /Set dev to Terraform 1\.5\.7 .*: dev's Terraform version has changed since this was proposed/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Apply/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Edit main.tf' }),
    ).toBeDisabled();
    expect(fileService.refreshFile).toHaveBeenCalledWith('main');
    expect(fileService.loadFilesByDirectory).not.toHaveBeenCalled();
    // the refused change touched nothing
    expect(workspacesApi.getWorkspace).not.toHaveBeenCalled();
  });

  /**
   * Verifies: a follow-up resends the conversation, the earlier reply with what it proposed and what was applied.
   * Interacts with: AiAssistService.askAiAssistant, applyAiAssistantChanges.
   * Data: one turn applied, then a second request.
   */
  it('resends the conversation with a follow-up', async () => {
    const { assistApi, user } = await renderPanel();
    await ask(user);
    await user.click(screen.getByRole('button', { name: 'Apply 3 changes' }));

    await ask(user, 'now plan it');

    const [, request] = assistApi.askAiAssistant.mock.calls[1] as unknown as [
      string,
      { history: { role: string; text: string }[] },
    ];
    expect(request.history[0]).toEqual({
      role: 'planner',
      text: 'fix the errors from the last apply',
    });
    expect(request.history[1].role).toBe('assistant');
    expect(request.history[1].text).toContain(
      'Proposed: Edit main.tf; Add variables.tf; Set dev to Terraform 1.5.7 (now 0.12.29).',
    );
    expect(request.history[1].text).toContain(
      'Applied: Edit main.tf; Set dev to Terraform 1.5.7 (now 0.12.29) (not applied:',
    );
  });

  /**
   * Verifies: a failed request says why in the conversation, and the planner can ask again.
   * Interacts with: AiAssistService.askAiAssistant answering 409.
   * Data: AI turned off on the server.
   */
  it('shows why a request failed', async () => {
    const { user } = await renderPanel({
      askAiAssistant: vi.fn(() =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { title: 'AI drafting is not enabled on this server.' },
            }),
        ),
      ),
    });

    await ask(user);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'AI drafting is not enabled on this server.',
    );
    expect(
      screen.getByRole('textbox', { name: 'What should change?' }),
    ).toBeEnabled();
  });

  /**
   * Verifies: the panel follows the open tab until a conversation starts; then it stays on its directory.
   * Interacts with: the directoryId input.
   * Data: lab open, then range; then a conversation on range and lab opened again.
   */
  it('follows the open tab until a conversation starts', async () => {
    const { fixture, assistApi, user } = await renderPanel(undefined, {
      projectId: 'p1',
      directoryId: 'lab',
    });

    fixture.componentRef.setInput('directoryId', 'range');
    fixture.detectChanges();
    expect(
      screen.getByRole('combobox', { name: 'Directory' }),
    ).toHaveTextContent('range');
    // range has no workspaces
    expect(
      screen.queryByRole('combobox', { name: 'Workspace' }),
    ).not.toBeInTheDocument();

    await ask(user, 'add a file');
    fixture.componentRef.setInput('directoryId', 'lab');
    fixture.detectChanges();
    await ask(user, 'and another');

    expect(
      assistApi.askAiAssistant.mock.calls.map((c) => (c as unknown[])[0]),
    ).toEqual(['range', 'range']);
  });

  /**
   * Verifies: an answer that arrives after the request shows, and the prompt opens again, when the panel sits in an
   * OnPush view as it does on the project page.
   * Interacts with: AiAssistService.askAiAssistant answering later.
   * Data: an example asked; the answer sent once the spinner shows.
   */
  it('shows a later answer inside an OnPush parent', async () => {
    const { user } = await renderComponent(OnPushHost, {
      providers: [
        {
          provide: AiAssistService,
          // the answer comes back on a later task, as an HTTP response does
          useValue: {
            askAiAssistant: vi.fn(() =>
              timer(20).pipe(map(() => structuredClone(ANSWER))),
            ),
          },
        },
        { provide: WorkspacesService, useValue: {} },
        {
          provide: DirectoryQuery,
          useValue: { selectAll: () => of(DIRECTORIES) },
        },
        {
          provide: WorkspaceQuery,
          useValue: { selectAll: () => of(WORKSPACES) },
        },
        { provide: FileService, useValue: {} },
        { provide: WorkspaceService, useValue: {} },
        {
          provide: CurrentUserQuery,
          useValue: { userTheme$: new BehaviorSubject<Theme>(Theme.LIGHT) },
        },
      ],
      configureTestBed: (testBed) =>
        testBed.overrideComponent(ProjectAssistantComponent, {
          remove: { imports: [DiffEditorComponent, EditorComponent] },
          add: { imports: [DiffEditorStub, EditorStub] },
        }),
    }).then(() => ({ user: userEvent.setup() }));

    await user.click(
      screen.getByRole('button', { name: 'Why did the last run fail?' }),
    );
    expect(screen.getByText('Working out the changes...')).toBeInTheDocument();

    expect(
      await screen.findByText(/count in a module block needs Terraform 0\.13/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Working out the changes...'),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'What should change?' }),
      ).toBeEnabled(),
    );

    await user.click(screen.getByRole('button', { name: 'Show changes' }));
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
  });
});
