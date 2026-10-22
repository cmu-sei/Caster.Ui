// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { EventEmitter } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort, SortDirection } from '@angular/material/sort';
import { BehaviorSubject, firstValueFrom, Observable, of, Subject } from 'rxjs';
import { recordEmissions } from '../../../test-utils/record-emissions';
import * as cwdTableUtils from './datasource-utils';
import * as rootUtils from '../../../datasource-utils';

// src/app/datasource-utils.ts is a copy of this file that nothing imports
// (only cwd-table.component.ts imports, from this copy). The copies behave
// identically, so one suite runs against both. `satisfies DatasourceUtils`
// checks at compile time that both copies export the same API. (The two
// SimpleDataSource classes aren't mutually assignable because each declares
// its own private `rows$`, hence the structural constructor type.)
interface DatasourceUtils {
  SimpleDataSource: new <T>(rows$: Observable<T[]>) => DataSource<T>;
  fromMatSort: typeof cwdTableUtils.fromMatSort;
  fromMatPaginator: typeof cwdTableUtils.fromMatPaginator;
  sortRows: typeof cwdTableUtils.sortRows;
  paginateRows: typeof cwdTableUtils.paginateRows;
}
const copies = [
  {
    copy: 'sei-cwd-common/cwd-table/utils (used by cwd-table)',
    utils: cwdTableUtils satisfies DatasourceUtils,
  },
  {
    copy: 'src/app/datasource-utils (unused)',
    utils: rootUtils satisfies DatasourceUtils,
  },
] as Array<{ copy: string; utils: DatasourceUtils }>;

interface Row {
  id: string;
  name?: string | null;
  size?: number;
  created?: Date;
}

/** The parts of MatSort that fromMatSort reads. */
function sortStub(active: string, direction: SortDirection) {
  const stub: Pick<MatSort, 'active' | 'direction' | 'sortChange'> = {
    active,
    direction,
    sortChange: new EventEmitter<Sort>(),
  };
  return stub;
}

/** The parts of MatPaginator that fromMatPaginator reads. */
function paginatorStub(pageIndex: number, pageSize: number, length: number) {
  const stub: Pick<MatPaginator, 'pageIndex' | 'pageSize' | 'length' | 'page'> =
    {
      pageIndex,
      pageSize,
      length,
      page: new EventEmitter<PageEvent>(),
    };
  return stub;
}

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe.each(copies)('datasource utils: $copy', ({ utils }) => {
  describe('SimpleDataSource', () => {
    /**
     * Verifies: connect() hands the table the rows observable it was built with, and disconnect() is a safe no-op.
     * Interacts with: CDK DataSource contract.
     * Data: a BehaviorSubject of two rows; an empty CollectionViewer.
     */
    it('connects the table to the given rows stream', async () => {
      const rows$ = new BehaviorSubject<Row[]>([{ id: 'a' }, { id: 'b' }]);
      const source = new utils.SimpleDataSource(rows$);
      const viewer: CollectionViewer = {
        viewChange: of({ start: 0, end: 10 }),
      };

      expect(source.connect(viewer)).toBe(rows$);
      expect(() => source.disconnect(viewer)).not.toThrow();
      expect(await firstValueFrom(source.connect(viewer))).toHaveLength(2);
    });
  });

  describe('fromMatSort()', () => {
    /**
     * Verifies: the stream starts with the sort state read at subscribe time, then emits every sortChange.
     * Interacts with: MatSort.active/direction/sortChange (typed stub).
     * Data: the stub changes from name/asc to size/desc after the stream is created but before it is subscribed.
     */
    it('emits the current sort on subscribe, then each change', () => {
      const sort = sortStub('name', 'asc');
      const sort$ = utils.fromMatSort(sort as MatSort);
      sort.active = 'size';
      sort.direction = 'desc';

      const emissions = recordEmissions(sort$);
      sort.sortChange.emit({ active: 'id', direction: 'asc' });

      expect(emissions).toEqual([
        { active: 'size', direction: 'desc' },
        { active: 'id', direction: 'asc' },
      ]);
    });
  });

  describe('fromMatPaginator()', () => {
    /**
     * Verifies: the stream starts with the paginator state read at subscribe time, then emits every page event.
     * Interacts with: MatPaginator.pageIndex/pageSize/length/page (typed stub).
     * Data: page 0 of size 10 (length 42), then a page event to page 2.
     */
    it('emits the current page on subscribe, then each page event', () => {
      const pager = paginatorStub(0, 10, 42);

      const emissions = recordEmissions(
        utils.fromMatPaginator(pager as MatPaginator),
      );
      pager.page.emit({
        pageIndex: 2,
        pageSize: 10,
        length: 42,
        previousPageIndex: 0,
      });

      expect(emissions).toEqual([
        { pageIndex: 0, pageSize: 10, length: 42 },
        { pageIndex: 2, pageSize: 10, length: 42, previousPageIndex: 0 },
      ]);
    });
  });

  describe('sortRows()', () => {
    const rows: Row[] = [
      { id: 'c', name: 'charlie', size: 3 },
      { id: 'n', name: null, size: 1 },
      { id: 'a', name: 'alpha', size: 2 },
      { id: 'u', size: 4 },
    ];

    const sorted = async (sort: Sort, sortFns = {}, input = rows) =>
      firstValueFrom(of(input).pipe(utils.sortRows<Row>(of(sort), sortFns)));

    /**
     * Verifies: with no active column, or an empty direction, the rows pass through untouched (same array).
     * Interacts with: sortRows/toSortFn.
     * Data: Sort with active '' and Sort with direction ''.
     */
    it('leaves rows unsorted without an active column or direction', async () => {
      expect(await sorted({ active: '', direction: 'asc' })).toBe(rows);
      expect(await sorted({ active: 'name', direction: '' })).toBe(rows);
    });

    /**
     * Verifies: ascending sort on a property puts null and undefined first (as equals), then orders by < and >, without mutating the input.
     * Interacts with: sortRows/toSortFn/defaultSort.
     * Data: names charlie, null, alpha and a row with no name.
     */
    it('sorts ascending by property with null and undefined first', async () => {
      const input = [...rows];

      const result = await sorted(
        { active: 'name', direction: 'asc' },
        {},
        input,
      );

      expect(ids(result)).toEqual(['n', 'u', 'a', 'c']);
      expect(ids(input)).toEqual(['c', 'n', 'a', 'u']);
    });

    /**
     * Verifies: descending sort reverses the comparison, so null and undefined go last.
     * Interacts with: sortRows/toSortFn/defaultSort.
     * Data: the same rows, sorted desc by name, then desc by size.
     */
    it('sorts descending with null and undefined last', async () => {
      expect(ids(await sorted({ active: 'name', direction: 'desc' }))).toEqual([
        'c',
        'a',
        'n',
        'u',
      ]);
      expect(ids(await sorted({ active: 'size', direction: 'desc' }))).toEqual([
        'u',
        'c',
        'a',
        'n',
      ]);
    });

    /**
     * Verifies: distinct Date objects are ordered by time, and two Dates with the same time compare as equal, so their rows keep their input order in both directions.
     * Interacts with: defaultSort (its final "neither < nor >" branch).
     * Data: x and z created at the same instant (separate Date objects), y a day earlier.
     */
    it('orders Dates by time and keeps equal Dates in input order', async () => {
      const dated: Row[] = [
        { id: 'x', created: new Date('2026-01-02T00:00:00Z') },
        { id: 'y', created: new Date('2026-01-01T00:00:00Z') },
        { id: 'z', created: new Date('2026-01-02T00:00:00Z') },
      ];

      expect(
        ids(await sorted({ active: 'created', direction: 'asc' }, {}, dated)),
      ).toEqual(['y', 'x', 'z']);
      expect(
        ids(await sorted({ active: 'created', direction: 'desc' }, {}, dated)),
      ).toEqual(['x', 'z', 'y']);
    });

    /**
     * Verifies: string comparison is by code point, so upper-case names sort before lower-case ones.
     * Interacts with: defaultSort.
     * Data: names 'beta', 'Alpha', 'alpha', 'Zulu'.
     */
    it('compares strings case-sensitively', async () => {
      const mixed: Row[] = [
        { id: 'beta', name: 'beta' },
        { id: 'Alpha', name: 'Alpha' },
        { id: 'alpha', name: 'alpha' },
        { id: 'Zulu', name: 'Zulu' },
      ];

      // The default sort compares with plain < / > on purpose
      // (datasource-utils.ts:44-47, 76-77), as MatTableDataSource does, so
      // upper case sorts before lower case: 'Zulu' comes before 'alpha'.
      expect(
        ids(await sorted({ active: 'name', direction: 'asc' }, {}, mixed)),
      ).toEqual(['Alpha', 'Zulu', 'alpha', 'beta']);
    });

    /**
     * Verifies: a sort function supplied for the active column replaces the default comparison, and desc reverses it.
     * Interacts with: sortRows/toSortFn.
     * Data: a custom 'name' sort by name length.
     */
    it('uses a custom sort function for the active column', async () => {
      const byLength = {
        name: (a: Row, b: Row) => (a.name?.length ?? 0) - (b.name?.length ?? 0),
      };
      const named = rows.filter((r) => r.name);

      expect(
        ids(
          await sorted({ active: 'name', direction: 'asc' }, byLength, named),
        ),
      ).toEqual(['a', 'c']);
      expect(
        ids(
          await sorted({ active: 'name', direction: 'desc' }, byLength, named),
        ),
      ).toEqual(['c', 'a']);
    });

    /**
     * Verifies: with useDefault false, a column with no sort function errors the stream.
     * Interacts with: sortRows/toSortFn.
     * Data: Sort on 'size' with no sortFns and useDefault false.
     */
    it('errors for an unknown column when defaults are disabled', async () => {
      const result = firstValueFrom(
        of(rows).pipe(
          utils.sortRows<Row>(
            of<Sort>({ active: 'size', direction: 'asc' }),
            {},
            false,
          ),
        ),
      );

      await expect(result).rejects.toThrow('Unknown sort property [size]');
    });

    /**
     * Verifies: the output re-sorts when either the rows or the sort change.
     * Interacts with: sortRows (combineLatest of rows$ and sort$).
     * Data: rows and sort as Subjects; a new row arrives, then the direction flips.
     */
    it('re-sorts when rows or sort change', () => {
      const rows$ = new BehaviorSubject<Row[]>([{ id: 'b' }, { id: 'a' }]);
      const sort$ = new BehaviorSubject<Sort>({
        active: 'id',
        direction: 'asc',
      });
      const emissions = recordEmissions(rows$.pipe(utils.sortRows<Row>(sort$)));

      rows$.next([{ id: 'b' }, { id: 'c' }, { id: 'a' }]);
      sort$.next({ active: 'id', direction: 'desc' });

      expect(emissions.map(ids)).toEqual([
        ['a', 'b'],
        ['a', 'b', 'c'],
        ['c', 'b', 'a'],
      ]);
    });
  });

  describe('paginateRows()', () => {
    const rows: Row[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    const page = (pageIndex: number, pageSize: number): PageEvent => ({
      pageIndex,
      pageSize,
      length: rows.length,
    });

    /**
     * Verifies: each page holds pageSize rows starting at pageIndex * pageSize; the last page is short and a page past the end is empty.
     * Interacts with: paginateRows.
     * Data: five rows, page size 2, pages 0, 2 and 3.
     */
    it('slices the rows for the current page', async () => {
      const at = (p: PageEvent) =>
        firstValueFrom(of(rows).pipe(utils.paginateRows<Row>(of(p))));

      expect(ids(await at(page(0, 2)))).toEqual(['a', 'b']);
      expect(ids(await at(page(2, 2)))).toEqual(['e']);
      expect(await at(page(3, 2))).toEqual([]);
      expect(rows).toHaveLength(5);
    });

    /**
     * Verifies: the page is recomputed when the paginator or the rows change.
     * Interacts with: paginateRows (combineLatest of rows$ and page$).
     * Data: page 0 size 2, then page 1, then the rows shrink to three.
     */
    it('re-slices when the page or rows change', () => {
      const rows$ = new BehaviorSubject<Row[]>(rows);
      const page$ = new Subject<PageEvent>();
      const emissions = recordEmissions(
        rows$.pipe(utils.paginateRows<Row>(page$)),
      );

      page$.next(page(0, 2));
      page$.next(page(1, 2));
      rows$.next(rows.slice(0, 3));

      expect(emissions.map(ids)).toEqual([['a', 'b'], ['c', 'd'], ['c']]);
    });
  });
});
