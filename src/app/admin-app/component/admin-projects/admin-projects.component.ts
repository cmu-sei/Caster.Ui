// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import { CrucibleDialogService } from '@cmusei/crucible-common';
import { EMPTY, Observable } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';
import {
  Project,
  ProjectPermission,
  ProjectPermissionsClaim,
  SystemPermission,
} from 'src/app/generated/caster-api';
import { PermissionService } from 'src/app/permissions/permission.service';
import { ProjectQuery, ProjectService } from 'src/app/project';
import { ProjectMembershipsComponent } from 'src/app/project/component/project-memberships/project-memberships/project-memberships.component';
import { NameDialogComponent } from 'src/app/sei-cwd-common/name-dialog/name-dialog.component';

/** When a project was created, in the viewer's time zone, e.g. "Nov 6, 2026, 9:40 PM EST". */
export function formatCreated(value: string | null | undefined): string {
  return value
    ? new Date(value).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : '';
}

/** The text of an API failure: its problem title and detail, else the error's message. */
export function problemText(error: any, fallback: string): string {
  const problem = error?.error;
  const parts = [problem?.title, problem?.detail].filter((x) => !!x);
  return parts.length
    ? parts.join(': ')
    : error?.message || error?.statusText || fallback;
}

interface NameDialogResult {
  nameValue: string;
  descriptionValue?: string;
}

/**
 * Every project, for administrators: the same toolbar and table as the other
 * admin pages, with a project's memberships opening in place under its row.
 * The landing page's My Projects list stays separate.
 */
@Component({
  selector: 'cas-admin-projects',
  templateUrl: './admin-projects.component.html',
  styleUrls: ['./admin-projects.component.scss'],
  imports: [
    FormsModule,
    RouterLink,
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
    ProjectMembershipsComponent,
  ],
})
export class AdminProjectsComponent implements OnInit {
  private projectService = inject(ProjectService);
  private projectQuery = inject(ProjectQuery);
  private permissionService = inject(PermissionService);
  private confirmService = inject(CrucibleDialogService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  readonly displayedColumns = ['actions', 'name', 'description', 'dateCreated'];
  readonly dataSource = new MatTableDataSource<Project>([]);
  readonly formatCreated = formatCreated;

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  readonly projects = toSignal(this.projectQuery.selectAll(), {
    initialValue: [] as Project[],
  });
  readonly loading = signal(true);
  readonly expandedId = signal<string | null>(null);

  private readonly systemPermissions = toSignal(
    this.permissionService.permissions$,
    { initialValue: [] as SystemPermission[] },
  );
  private readonly projectPermissions = toSignal(
    this.permissionService.projectPermissions$,
    { initialValue: [] as ProjectPermissionsClaim[] },
  );

  readonly canCreate = computed(() =>
    this.systemPermissions().includes(SystemPermission.CreateProjects),
  );

  filterString = '';

  constructor() {
    this.dataSource.filterPredicate = (project, filter) =>
      [project.name, project.description, formatCreated(project.dateCreated)]
        .filter((x) => !!x)
        .join(' ')
        .toLowerCase()
        .includes(filter);
    this.dataSource.sortingDataAccessor = (project, column) =>
      column === 'dateCreated'
        ? (project.dateCreated ?? '')
        : (((project as Record<string, unknown>)[column] as string) ?? '')
            .toString()
            .toLowerCase();
    effect(() => {
      this.dataSource.data = this.projects();
    });
    effect(() => {
      this.dataSource.paginator = this.paginator();
      this.dataSource.sort = this.sort();
    });
  }

  ngOnInit(): void {
    this.permissionService
      .loadProjectPermissions()
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
    this.projectService
      .loadProjects(false)
      .pipe(
        take(1),
        catchError((error) => {
          this.notify(problemText(error, "Couldn't load the Projects"));
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Rename and Delete need ManageProjects, or ManageProject on that project, as the API requires. */
  canManage(project: Project): boolean {
    return (
      this.systemPermissions().includes(SystemPermission.ManageProjects) ||
      this.projectPermissions().some(
        (claim) =>
          claim.projectId === project.id &&
          claim.permissions?.includes(ProjectPermission.ManageProject),
      )
    );
  }

  applyFilter(value: string) {
    // Lowercase only the filter: filterString is bound to the Search box.
    this.dataSource.filter = value.trim().toLowerCase();
  }

  clearFilter() {
    this.filterString = '';
    this.applyFilter('');
  }

  isExpanded(project: Project): boolean {
    return this.expandedId() === project.id;
  }

  toggle(project: Project) {
    this.expandedId.set(this.isExpanded(project) ? null : project.id);
  }

  trackById(_index: number, project: Project): string {
    return project.id;
  }

  create() {
    this.nameDialog('Add New Project', '', '').subscribe((result) => {
      if (!result) {
        return;
      }
      this.projectService
        .createProject({
          name: result.nameValue,
          description: result.descriptionValue,
        } as Project)
        .pipe(
          take(1),
          catchError((error) => {
            this.notify(problemText(error, "Couldn't add the Project"));
            return EMPTY;
          }),
        )
        .subscribe((project) => this.notify(`Added Project ${project.name}`));
    });
  }

  rename(project: Project) {
    this.nameDialog(
      'Rename ' + project.name,
      project.name,
      project.description,
    ).subscribe((result) => {
      if (!result) {
        return;
      }
      this.projectService
        .updateProject({
          ...project,
          name: result.nameValue,
          description: result.descriptionValue,
        })
        .pipe(
          take(1),
          catchError((error) => {
            this.notify(problemText(error, `Couldn't rename ${project.name}`));
            return EMPTY;
          }),
        )
        .subscribe((updated) => this.notify(`Saved Project ${updated.name}`));
    });
  }

  /**
   * The API refuses to delete a project with deployed resources or pending
   * runs, and says which; that answer is shown as is.
   */
  delete(project: Project) {
    this.confirmService
      .confirm({
        title: 'Delete Project',
        message: `Are you sure that you want to delete ${project.name}?`,
        confirmText: 'Delete',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.projectService
          .deleteProject(project.id)
          .pipe(
            take(1),
            catchError((error) => {
              this.notify(
                problemText(error, `Couldn't delete ${project.name}`),
              );
              return EMPTY;
            }),
          )
          .subscribe(() => {
            if (this.isExpanded(project)) {
              this.expandedId.set(null);
            }
            this.notify(`Deleted Project ${project.name}`);
          });
      });
  }

  private nameDialog(
    title: string,
    name: string,
    description: string,
  ): Observable<NameDialogResult | undefined> {
    const dialogRef = this.dialog.open(NameDialogComponent, {
      data: {
        nameValue: name,
        showDescription: true,
        descriptionValue: description ?? '',
      },
      minWidth: '400px',
      maxWidth: '90vw',
    });
    dialogRef.componentInstance.title = title;
    dialogRef.componentInstance.message = '';
    return dialogRef.afterClosed();
  }

  private notify(message: string) {
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      verticalPosition: 'top',
      horizontalPosition: 'center',
    });
  }
}
