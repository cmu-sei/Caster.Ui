// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AssignmentItem } from '../assignment.model';
import { AssignmentChecklistComponent } from './assignment-checklist.component';

const items: AssignmentItem[] = [
  { id: 'c', name: 'Charlie' },
  { id: 'a', name: 'Alpha', detail: 'first range' },
  { id: 'b', name: 'Bravo' },
  { id: 'g', name: 'Golf', locked: true, notes: ['via group Lab'] },
];

async function renderList(editable = true, selected = ['b']) {
  const view = await renderComponent(AssignmentChecklistComponent, {
    inputs: { items, initial: ['b'], selected, editable },
  });
  return { ...view, user: userEvent.setup() };
}

function rowNames(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((x) => x.querySelector('.name').textContent.trim());
}

describe('AssignmentChecklistComponent', () => {
  /**
   * Verifies: what is assigned comes first, then the rest by name; a group's item is checked and can't be changed.
   * Data: Bravo assigned; Golf through a group.
   */
  it('lists what is assigned first, then by name', async () => {
    await renderList();

    expect(rowNames()).toEqual(['Bravo', 'Golf', 'Alpha', 'Charlie']);
    expect(screen.getByRole('checkbox', { name: /Bravo/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Golf/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Golf/ })).toBeDisabled();
    expect(screen.getByText('via group Lab')).toBeInTheDocument();
  });

  /**
   * Verifies: checking and unchecking update the selection and mark each row's change.
   * Data: Bravo assigned; check Alpha, uncheck Bravo.
   */
  it('marks what a save would add and remove', async () => {
    const { user, fixture } = await renderList();

    await user.click(screen.getByRole('checkbox', { name: /Alpha/ }));
    await user.click(screen.getByRole('checkbox', { name: /Bravo/ }));

    expect(fixture.componentInstance.selected()).toEqual(['a']);
    const alpha = screen.getByRole('checkbox', { name: /Alpha/ }).closest('li');
    const bravo = screen.getByRole('checkbox', { name: /Bravo/ }).closest('li');
    expect(within(alpha).getByText('Adding')).toBeInTheDocument();
    expect(within(bravo).getByText('Removing')).toBeInTheDocument();
  });

  /**
   * Verifies: the search matches names and details; "Assigned only" hides the rest.
   * Data: "first" matches Alpha's detail.
   */
  it('searches names and details, and can show what is assigned only', async () => {
    const { user } = await renderList();

    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'first');
    expect(rowNames()).toEqual(['Alpha']);

    await user.clear(screen.getByRole('textbox', { name: 'Search' }));
    await user.click(screen.getByRole('switch', { name: 'Assigned only' }));
    expect(rowNames()).toEqual(['Bravo', 'Golf']);
  });

  /**
   * Verifies: read-only, it lists what is assigned, without checkboxes or search.
   */
  it('lists only what is assigned when read-only', async () => {
    await renderList(false);

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(rowNames()).toEqual(['Bravo', 'Golf']);
  });
});
