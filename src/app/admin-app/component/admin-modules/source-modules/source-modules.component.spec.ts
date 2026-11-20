// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { Module, ModuleSource } from 'src/app/generated/caster-api';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ModuleRow, toModuleRow } from '../module-source-groups';
import { SourceModulesComponent } from './source-modules.component';

const cmu: ModuleSource = { name: 'cmu', provider: 'git' };
const gitlab: ModuleSource = { name: 'gitlab', provider: 'gitlab' };
const sources = [cmu, gitlab];

const longDescription = 'A'.repeat(90);
const exercise: Module = {
  id: 'm1',
  name: 'exercise-x',
  path: 'cmu/exercise-x',
  description: longDescription,
  dateModified: '2026-10-14T12:30:00Z',
  latestVersion: 'v1.10.0',
  inSource: true,
};
const bare: Module = {
  id: 'm2',
  name: 'bare',
  path: 'cmu/bare',
  inSource: true,
};
const dns: Module = { id: 'm3', name: 'dns', path: 'group/dns' };
const stale: Module = {
  id: 'm4',
  name: 'stale',
  path: 'cmu/stale',
  missingSince: '2026-10-01T12:00:00Z',
};
const stray: Module = { id: 'm5', name: 'stray', path: 'uni/stray' };

const rows = (modules: Module[], of = sources): ModuleRow[] =>
  modules.map((m) => toModuleRow(m, of));

interface Options {
  source?: ModuleSource | null;
  modules?: Module[];
  total?: number;
  /** The configured sources; GitLab is among them unless a test says not. */
  configured?: ModuleSource[];
  canEdit?: boolean;
  confirmed?: boolean;
}

async function renderTable({
  source = cmu,
  modules = [exercise, bare],
  total = modules.length,
  configured = sources,
  canEdit = true,
  confirmed,
}: Options = {}) {
  const deleted = vi.fn<(id: string) => void>();
  const { dialogRef } = dialogRefStub<unknown, boolean>(confirmed);
  const confirm = vi.fn(() => dialogRef);
  const view = await renderComponent(SourceModulesComponent, {
    providers: [{ provide: CrucibleDialogService, useValue: { confirm } }],
    inputs: {
      source,
      modules: rows(modules, configured),
      total,
      sources: configured,
      canEdit,
    },
    on: { remove: deleted },
  });
  return {
    ...view,
    user: userEvent.setup(),
    /** Changes inputs the way a parent would, then renders. */
    set: (inputs: Record<string, unknown>) => {
      for (const [name, value] of Object.entries(inputs)) {
        view.fixture.componentRef.setInput(name, value);
      }
      view.fixture.detectChanges();
    },
    deleted,
    confirm,
  };
}

const text = (element: Element) => element.textContent?.trim() ?? '';

/** The row of the Module in the table. */
const moduleRow = (name: string) =>
  screen.getByRole('row', { name: new RegExp(`\\b${name}\\b`) });

/** The names of the Modules listed, in order. */
const names = () => {
  const column = screen
    .getAllByRole('columnheader')
    .findIndex((h) => text(h) === 'Name');
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => text(within(r).getAllByRole('cell')[column]).split(' ')[0]);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SourceModulesComponent', () => {
  describe('the table', () => {
    /**
     * Verifies: the columns are an actions column first, then name, path, latest version and description, with no Last Synced column.
     * Interacts with: the table template.
     * Data: cmu with a leftover, so there is an action.
     */
    it('lists the Modules in a table with the actions first', async () => {
      await renderTable({ modules: [stale, bare] });

      expect(screen.getAllByRole('columnheader').map((h) => text(h))).toEqual([
        '',
        'Name',
        'Path',
        'Latest Version',
        'Description',
      ]);
    });

    /**
     * Verifies: each Module row shows its description cut at 80 characters with the whole text in its title, and its highest version; a Module with no version says so.
     * Interacts with: shortDescription(), the table template.
     * Data: exercise-x (90-character description), bare (no versions).
     */
    it("shows each Module's description and latest version", async () => {
      await renderTable();

      const cells = within(moduleRow('exercise-x')).getAllByRole('cell');
      // Both are still in their source, so there is no actions column.
      expect(text(cells[1])).toBe('cmu/exercise-x');
      expect(text(cells[2])).toBe('v1.10.0');
      expect(text(cells[3])).toBe('A'.repeat(80) + ' ...');
      expect(cells[3]).toHaveAttribute('title', longDescription);
      expect(text(within(moduleRow('bare')).getAllByRole('cell')[2])).toBe(
        'No version',
      );
    });

    /**
     * Verifies: there is no Copy Terraform source button on a Module.
     * Interacts with: the actions cell.
     * Data: exercise-x has a version with a link.
     */
    it('has no Copy Terraform source button', async () => {
      await renderTable();

      expect(
        screen.queryByRole('button', { name: /Terraform source|Copy/ }),
      ).toBeNull();
    });

    /**
     * Verifies: the table sorts by a column when its header is clicked.
     * Interacts with: the sort headers, sortModules().
     * Data: exercise-x and bare, in name order.
     */
    it('sorts by a column', async () => {
      const { user } = await renderTable();
      expect(names()).toEqual(['exercise-x', 'bare']);

      await user.click(screen.getByRole('columnheader', { name: 'Name' }));
      expect(names()).toEqual(['bare', 'exercise-x']);
      await user.click(screen.getByRole('columnheader', { name: 'Name' }));
      expect(names()).toEqual(['exercise-x', 'bare']);
    });

    /**
     * Verifies: an open source with no Modules explains why instead of an empty table, differently for GitLab.
     * Interacts with: emptyText().
     * Data: cmu with none, gitlab with none.
     */
    it.each([
      { source: cmu, says: /found no Modules in this source/ },
      { source: gitlab, says: /Add a GitLab Project to add one/ },
    ])('explains an empty $source.name', async ({ source, says }) => {
      await renderTable({ source, modules: [] });

      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByPlaceholderText('Search')).toBeNull();
      expect(screen.getByText(says)).toBeInTheDocument();
    });
  });

  describe('searching and paging', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `m${i}`,
      name: `mod${String(i).padStart(2, '0')}`,
      path: `cmu/mod${i}`,
      inSource: true,
    })) as Module[];

    /**
     * Verifies: the table has its own Search that narrows the Modules, says when none match, and Clear Search brings them back.
     * Interacts with: the Search box, applyFilter(), moduleMatches().
     * Data: exercise-x and bare.
     */
    it('searches its own Modules and clears the search', async () => {
      const { user } = await renderTable();

      await user.type(screen.getByLabelText('Search Modules'), 'bar');
      expect(names()).toEqual(['bare']);

      await user.clear(screen.getByLabelText('Search Modules'));
      await user.type(screen.getByLabelText('Search Modules'), 'zzz');
      expect(screen.getByText('No Modules match "zzz"')).toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: 'Clear Module Search' }),
      );
      expect(names()).toEqual(['exercise-x', 'bare']);
    });

    /**
     * Verifies: the table lists 10 Modules a page, with a paginator that moves to the rest, replacing Show more.
     * Interacts with: the paginator, MODULE_PAGE_SIZES.
     * Data: 25 Modules.
     */
    it('lists 10 Modules a page', async () => {
      const { user } = await renderTable({ modules: many });

      expect(names()).toHaveLength(10);
      expect(await screen.findByText(/1\s.\s10 of 25/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Show .* more/ })).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Next page' }));
      expect(names()[0]).toBe('mod10');

      await user.click(screen.getByRole('button', { name: 'Next page' }));
      expect(names()).toHaveLength(5);
    });

    /**
     * Verifies: the Search finds a Module on a page that is not showing, and paging then covers only the matches.
     * Interacts with: the Search box and the paginator.
     * Data: 25 Modules; "mod2" matches mod2 and mod20 to mod24.
     */
    it('searches across pages', async () => {
      const { user } = await renderTable({ modules: many });

      await user.type(screen.getByLabelText('Search Modules'), 'mod2');

      expect(names()).toHaveLength(6);
      expect(screen.getByText(/1\s.\s6 of 6/)).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    /**
     * Verifies: the Modules have no Refresh button of their own, however they are of GitLab, of no configured source or a leftover, and no Last Synced column.
     * Interacts with: the actions cell and the column headers.
     * Data: exercise-x, dns (GitLab's), stray (not configured), stale (leftover).
     */
    it('has no Refresh button on any Module', async () => {
      await renderTable({
        source: null,
        modules: [exercise, dns, stray, stale],
        configured: sources,
      });

      expect(screen.queryByRole('button', { name: /Refresh/ })).toBeNull();
      expect(
        screen.queryByRole('columnheader', { name: /Last Synced/ }),
      ).toBeNull();
    });

    /**
     * Verifies: without ManageModules Delete is greyed out, named "(not available)", with the permission as the reason in a tooltip, and nothing is emitted.
     * Interacts with: the canEdit input, deleteDisabledReason().
     * Data: canEdit false; a leftover in the table.
     */
    it('greys out Delete without ManageModules', async () => {
      const { deleted } = await renderTable({
        source: null,
        modules: [stale],
        canEdit: false,
      });

      const deleteButton = screen.getByRole('button', {
        name: 'Delete stale (not available)',
      });
      expect(deleteButton).toBeDisabled();
      expect(deleteButton.parentElement).toHaveAccessibleDescription(
        'Deleting a Module needs the ManageModules permission',
      );
      expect(deleted).not.toHaveBeenCalled();
    });

    /**
     * Verifies: a Module with no available action gets no empty button, and when no Module in the table has an action the actions column is omitted altogether.
     * Interacts with: displayedColumns, canDelete().
     * Data: bare and exercise-x, both still in their git source.
     */
    it('omits the actions column when no Module has an action', async () => {
      await renderTable({
        modules: [
          { ...bare, missingSince: null },
          { ...exercise, missingSince: null },
        ],
      });

      expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
      expect(screen.getAllByRole('columnheader').map((h) => text(h))).toEqual([
        'Name',
        'Path',
        'Latest Version',
        'Description',
      ]);
    });

    /**
     * Verifies: with a leftover among the Modules the actions column is shown, and only the leftover's row has a button.
     * Interacts with: displayedColumns, canDelete().
     * Data: stale (leftover) and bare (still there).
     */
    it('shows the actions column with an empty cell for a Module with no action', async () => {
      await renderTable({
        modules: [stale, { ...bare, missingSince: null }],
      });

      expect(text(screen.getAllByRole('columnheader')[0])).toBe('');
      expect(within(moduleRow('bare')).queryByRole('button')).toBeNull();
      expect(
        within(moduleRow('stale')).getByRole('button', {
          name: 'Delete stale',
        }),
      ).toBeInTheDocument();
    });

    /**
     * Verifies: Delete is only for a Module no longer in its source or of the GitLab source; one still in its source has none.
     * Interacts with: canDelete().
     * Data: a source that reports missingSince: stale is a leftover, bare is still there.
     */
    it('offers Delete only for leftovers and GitLab Modules', async () => {
      await renderTable({
        modules: [stale, { ...bare, missingSince: null }],
      });

      expect(screen.getByRole('button', { name: 'Delete stale' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Delete bare' })).toBeNull();
    });

    /**
     * Verifies: when the API does not say whether a Module is still in its source, a git Module has no Delete, the table says why, and a GitLab Module keeps its Delete.
     * Interacts with: canDelete(), presenceUnknown, the table template.
     * Data: cmu's exercise-x with no missingSince or inSource, and a GitLab Module the same.
     */
    it('offers no Delete on a git Module the API does not report on, and says why', async () => {
      const { fixture } = await renderTable({
        modules: [
          { id: 'g1', name: 'plain', path: 'cmu/plain' },
          { id: 'g2', name: 'lab', path: 'group/lab' },
        ],
      });

      expect(
        screen.getByText(
          /doesn't say which Modules are no longer in their source/,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete plain' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Delete lab' })).toBeTruthy();
      expect(fixture.componentInstance.presenceUnknown()).toBe(true);
    });

    /**
     * Verifies: a Module no configured source owns (its source was removed) gets Delete and the Not in source badge even though the API says it is still in its source, and the table adds no note about the API.
     * Interacts with: canDelete(), toModuleRow(), the table template.
     * Data: old/net with inSource true; source null (the leftover group), no GitLab source configured.
     */
    it('offers Delete on a Module of a removed source', async () => {
      await renderTable({
        source: null,
        configured: [cmu],
        modules: [{ id: 'o1', name: 'net', path: 'old/net', inSource: true }],
      });

      expect(screen.getByRole('button', { name: 'Delete net' })).toBeTruthy();
      expect(screen.getByText('Not in source')).toBeInTheDocument();
      expect(screen.queryByText(/doesn't say which Modules/)).toBeNull();
    });

    /**
     * Verifies: with the API reporting presence the table adds no such explanation.
     * Interacts with: presenceUnknown, the table template.
     * Data: bare and exercise-x, both reported still in their source.
     */
    it('adds no explanation when the API reports presence', async () => {
      await renderTable();

      expect(screen.queryByText(/doesn't say which Modules/)).toBeNull();
    });

    /**
     * Verifies: with no source the Modules are badged as not in their source, and Delete asks first and deletes only when confirmed.
     * Interacts with: CrucibleDialogService.confirm (stub), the remove output.
     * Data: stale (missingSince), stray; confirmed, then not.
     */
    it.each([
      { confirmed: true, calls: [['m4']] },
      { confirmed: false, calls: [] },
    ])(
      'deletes a leftover only when confirmed ($confirmed)',
      async ({ confirmed, calls }) => {
        const { user, deleted, confirm } = await renderTable({
          source: null,
          modules: [stale, stray],
          confirmed,
        });

        expect(screen.getByText('Not in source')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Delete stale' }));

        expect(confirm).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Delete Module' }),
        );
        expect(deleted.mock.calls).toStrictEqual(calls);
      },
    );
  });
});
