// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import {
  Component,
  OnInit,
  NgZone,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ErrorStateMatcher } from '@angular/material/core';
import { UntypedFormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ModuleService, ModuleQuery } from '../../../modules/state';
import {
  Module,
  ModuleScope,
  ModuleSource,
  ModulesService,
  SystemPermission,
} from '../../../generated/caster-api';
import { EMPTY, Observable, combineLatest, of } from 'rxjs';
import { catchError, finalize, map, switchMap, take } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PermissionService } from 'src/app/permissions/permission.service';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatNoDataRow,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource,
} from '@angular/material/table';
import { MatTooltip } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { ClipboardModule } from 'ngx-clipboard';
import { SourceModulesComponent } from './source-modules/source-modules.component';
import { GitlabProjectDialogComponent } from './gitlab-project-dialog/gitlab-project-dialog.component';
import {
  SourceTableRow,
  formatSyncTime,
  groupModules,
  isGitlabSource,
  sortSourceRows,
  SHARED_TOOLTIP,
  sourceAccessRows,
  sourceTableRows,
  viewGroups,
} from './module-source-groups';
import { ModuleScopeService } from 'src/app/module-scopes/module-scope.service';
import {
  ProjectAccessDialogComponent,
  ProjectAccessDialogData,
} from './project-access-dialog/project-access-dialog.component';

/** The refreshing key for Refresh All Sources. */
export const ALL_SOURCES = '*';

@Component({
  selector: 'cas-admin-modules',
  templateUrl: './modules.component.html',
  styleUrls: ['./modules.component.css'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)'),
      ),
    ]),
  ],
  imports: [
    SourceModulesComponent,
    MatIcon,
    MatIconButton,
    MatFormField,
    MatInput,
    MatSuffix,
    MatPaginator,
    MatProgressSpinner,
    MatTooltip,
    MatTable,
    MatSort,
    MatSortHeader,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatNoDataRow,
    ClipboardModule,
    FormsModule,
  ],
})
export class AdminModulesComponent implements OnInit {
  zone = inject(NgZone);
  private moduleService = inject(ModuleService);
  private moduleQuery = inject(ModuleQuery);
  private modulesService = inject(ModulesService);
  private permissionService = inject(PermissionService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private moduleScopeService = inject(ModuleScopeService);

  readonly modules = toSignal(this.moduleQuery.selectAll(), {
    initialValue: [] as Module[],
  });
  readonly isLoading = toSignal(this.moduleQuery.selectLoading(), {
    initialValue: false,
  });
  public matcher = new ModuleErrorStateMatcher();
  public isLinear = false;
  readonly sources = signal<ModuleSource[]>([]);
  /** False when the API could not list its sources. */
  /**
   * What is being refreshed: source names, GitLab project IDs,
   * or ALL_SOURCES. Only those buttons wait, not every Refresh on the page.
   */
  public refreshing = new Set<string>();

  /** Syncing and deleting Modules need ManageModules, as the API requires. */
  public canEdit$ = this.permissionService.hasPermission(
    SystemPermission.ManageModules,
  );

  readonly canEdit = toSignal(this.canEdit$, { initialValue: false });

  /** Viewing the Module Scopes needs ViewModules or ManageModules, as the API requires. */
  private canViewScopes$ = combineLatest([
    this.permissionService.hasPermission(SystemPermission.ViewModules),
    this.canEdit$,
  ]).pipe(map(([view, manage]) => view || manage));

  /** Whether the API listed the sources; an older one does not. */
  readonly sourcesListed = signal(true);

  public scopes$ = this.moduleScopeService.scopes$;
  private readonly allScopes = toSignal(this.scopes$, {
    initialValue: [] as ModuleScope[],
  });
  /** Whether the scopes were read: false when the user may not view them or the API failed. */
  readonly scopesLoaded = signal(false);
  /** Why who may use a source is not shown. */
  readonly scopesUnavailable = signal<string | null>(null);
  /** The scopes, or null when they are not known. */
  readonly scopes = computed(() =>
    this.scopesLoaded() ? this.allScopes() : null,
  );

  /** What the search box holds. */
  readonly search = signal('');
  /** The sources the user opened, by name, and whether the leftover group is. Kept while searching. */
  readonly expanded = signal<ReadonlySet<string>>(new Set());
  /** What the user opened or closed since the search last changed; it wins over what the search opens. */
  private readonly searchToggled = signal<ReadonlyMap<string, boolean>>(
    new Map(),
  );

  readonly groups = computed(() =>
    groupModules(this.modules(), this.sources()),
  );
  readonly view = computed(() =>
    viewGroups(this.sources(), this.groups(), this.search()),
  );
  readonly access = computed(() => {
    const scopes = this.scopes();
    return scopes ? sourceAccessRows(this.sources(), scopes) : null;
  });
  /** The table's rows: the sources the search keeps, then the leftover group. */
  readonly rows = computed(() => sourceTableRows(this.view(), this.access()));

  readonly displayedColumns = [
    'actions',
    'name',
    'status',
    'modules',
    'access',
    'lastSuccess',
  ];
  readonly dataSource = new MatTableDataSource<SourceTableRow>([]);
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  constructor() {
    this.dataSource.sortData = (data, sort) =>
      sortSourceRows(data, sort.active, sort.direction);
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.dataSource.paginator = this.paginator();
      this.dataSource.sort = this.sort();
    });
  }

  readonly about =
    "Modules come from module sources: git repositories listed in Caster's settings. " +
    'Caster reads every source when this page opens and lists each Module it finds. ' +
    "To add a Module, add it to a source's repository with a variables.tf.json and a version tag, " +
    'such as v1.0.0, then Refresh that source.';

  setSearch(value: string) {
    this.search.set(value.trim());
    this.searchToggled.set(new Map());
  }

  trackByKey(_index: number, row: SourceTableRow): string {
    return row.key;
  }

  /** "3 modules", or "1 of 3" while the search keeps only some of them. */
  countText(row: SourceTableRow): string {
    return row.modules.length === row.total
      ? `${row.total}`
      : `${row.modules.length} of ${row.total}`;
  }

  /** When the source was last read successfully, in the viewer's time zone. */
  lastUpdated(row: SourceTableRow): string {
    return row.source?.lastSuccess
      ? formatSyncTime(row.source.lastSuccess)
      : '';
  }

  isGitlab(source: ModuleSource): boolean {
    return isGitlabSource(source);
  }

  /** Refreshing this source, or every source at once. */
  isSourceRefreshing(source: ModuleSource): boolean {
    return this.refreshing.has(source.name) || this.refreshing.has(ALL_SOURCES);
  }

  /** Why Refresh and Add a GitLab Project are not available on a source, or null when they are. */
  readonly editReason = computed(() =>
    this.canEdit()
      ? null
      : 'Refreshing Modules needs the ManageModules permission',
  );

  /** Why Refresh All Sources is not available, or null when it is. */
  readonly refreshAllReason = computed(() => {
    if (!this.canEdit()) {
      return this.editReason();
    }
    return this.sources().length
      ? null
      : 'There are no module sources to refresh';
  });

  readonly sharedTooltip = SHARED_TOOLTIP;

  /** Why Project access is unavailable on a source, or null when it can be used. */
  accessDisabledReason(row: SourceTableRow): string | null {
    if (!this.canEdit()) {
      return 'Changing project access needs the ManageModules permission';
    }
    if (row.source?.shared) {
      return `${SHARED_TOOLTIP}, so there is nothing to assign`;
    }
    return row.access ? null : this.scopesUnavailable();
  }

  /** The source's clone URL, when the API reports it (credentials already removed). */
  repositoryUrl(source: ModuleSource): string | null {
    return (source as ModuleSource & { url?: string | null }).url || null;
  }

  /** A GitLab source adds one project at a time, by its ID. */
  addGitlabProject() {
    if (!this.canEdit()) {
      return;
    }
    this.dialog
      .open<GitlabProjectDialogComponent, unknown, string>(
        GitlabProjectDialogComponent,
        { width: '400px' },
      )
      .afterClosed()
      .subscribe((projectId) => {
        if (projectId) {
          this.refresh(projectId);
        }
      });
  }

  /** Whether a source (or the leftover group) is open: by the search while searching, else as the user left it. */
  isOpen(key: string, forceOpen: boolean): boolean {
    if (this.search()) {
      return this.searchToggled().get(key) ?? forceOpen;
    }
    return this.expanded().has(key);
  }

  toggle(key: string, forceOpen: boolean) {
    const open = !this.isOpen(key, forceOpen);
    if (this.search()) {
      this.searchToggled.set(new Map(this.searchToggled()).set(key, open));
      return;
    }
    const next = new Set(this.expanded());
    if (open) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.expanded.set(next);
  }

  /**
   * Initialize component
   */
  ngOnInit() {
    this.loadScopes();
    this.load();
  }

  /**
   * Load the Modules. Listing them is what reads the sources, so ask how that
   * went once it is done. When the user asked for the refresh, also say in a
   * snack bar which sources failed.
   */
  load(userRequested = false, forceUpdate = false, done?: string) {
    // With each Module's latest version, not all its versions.
    this.moduleService
      .load(false, true, forceUpdate, true)
      .pipe(
        take(1),
        finalize(() => {
          if (done) {
            this.stopRefreshing(done);
          }
          this.loadSources(userRequested);
        }),
      )
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe();
  }

  /**
   * Read the Module Scopes once, in one request for every scope with the projects and groups
   * it is assigned to: that is what says who may use each source, so nothing is asked per
   * project. Without the permission, or when the API can't, the sources are shown without it.
   */
  private loadScopes() {
    this.canViewScopes$
      .pipe(
        take(1),
        switchMap((canView) => {
          if (!canView) {
            this.scopesUnavailable.set(
              'Who may use a source needs the ViewModules or ManageModules permission.',
            );
            return of(null);
          }
          return this.moduleScopeService.load().pipe(
            catchError(() => {
              this.scopesUnavailable.set(
                "Module Scopes couldn't be loaded, so who may use each source isn't shown.",
              );
              return of(null);
            }),
          );
        }),
      )
      .subscribe((scopes) => {
        this.scopesLoaded.set(!!scopes);
        if (scopes) {
          this.scopesUnavailable.set(null);
        }
      });
  }

  /** Project access for a source: who may use it, through the source's own scope. */
  manageAccess(source: string) {
    if (!this.canEdit()) {
      return;
    }
    this.dialog.open<
      ProjectAccessDialogComponent,
      ProjectAccessDialogData,
      ModuleScope
    >(ProjectAccessDialogComponent, {
      data: { source, scopes: this.moduleScopeService.currentScopes() },
      width: '680px',
      maxWidth: '90vw',
      disableClose: true,
    });
  }

  /**
   * Re-read every source and every version, so a moved tag or a changed
   * caster.json without a new tag is picked up too.
   */
  refreshAll() {
    this.refreshing = new Set([...this.refreshing, ALL_SOURCES]);
    this.load(true, true, ALL_SOURCES);
  }

  private loadSources(userRequested = false) {
    this.modulesService
      .getModuleSources()
      .pipe(take(1))
      // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      .subscribe({
        next: (sources) => {
          this.sources.set(sources ?? []);
          this.sourcesListed.set(true);
          const failed = this.sources().filter((s) => s.error);
          if (userRequested && failed.length) {
            this.showRefreshFailures(failed);
          }
        },
        // An API that does not report its sources yet: say so, not an error.
        error: () => {
          this.sources.set([]);
          this.sourcesListed.set(false);
        },
      });
  }

  /** One snack bar for every failed source; the Module Sources list says why. */
  private showRefreshFailures(sources: ModuleSource[]) {
    const names = sources.map((s) => s.name);
    const message =
      names.length === 1
        ? `Module source ${names[0]} couldn't be read`
        : `Module sources ${names.join(', ')} couldn't be read`;
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      verticalPosition: 'top',
      horizontalPosition: 'center',
    });
  }

  loadById(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.loadModuleById(id).pipe(take(1)).subscribe();
  }

  /**
   * Re-read one source by its name, or add one GitLab
   * project by its ID, then reload the list.
   */
  refresh(id: string) {
    this.refreshing = new Set([...this.refreshing, id]);
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService
      .createOrUpdateModuleById(id)
      .pipe(
        take(1),
        catchError((error) => {
          const message =
            error.error?.title ||
            error.message ||
            "Couldn't refresh the Modules";
          this.snackBar.open(message, 'Dismiss', {
            duration: 5000,
            verticalPosition: 'top',
            horizontalPosition: 'center',
          });
          return EMPTY;
        }),
        finalize(() => this.stopRefreshing(id)),
      )
      .subscribe(() => this.load());
  }

  private stopRefreshing(id: string) {
    const next = new Set(this.refreshing);
    next.delete(id);
    this.refreshing = next;
  }

  deleteModule(id: string) {
    // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
    this.moduleService.delete(id).pipe(take(1)).subscribe();
  }
} // End Class

/** Error when invalid control is dirty, touched, or submitted. */
export class ModuleErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(
    control: UntypedFormControl | null,
    form: FormGroupDirective | NgForm | null,
  ): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || isSubmitted));
  }
}
