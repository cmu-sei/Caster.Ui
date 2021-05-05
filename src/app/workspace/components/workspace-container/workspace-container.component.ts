// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { shareReplay, take, tap } from 'rxjs/operators';
import { Breadcrumb } from 'src/app/project/state';
import { ConfirmDialogService } from 'src/app/sei-cwd-common/confirm-dialog/service/confirm-dialog.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { CurrentUserQuery } from 'src/app/users/state';
import {
  Resource,
  ResourceCommandResult,
  Run,
  RunStatus,
  Workspace,
} from '../../../generated/caster-api';
import {
  ResourceActions,
  StatusFilter,
  WorkspaceQuery,
  WorkspaceService,
} from '../../state';
import { ImportResourceComponent } from '../import-resource/import-resource.component';
import { OutputComponent } from '../output/output.component';

@Component({
  selector: 'cas-workspace-container',
  templateUrl: './workspace-container.component.html',
  styleUrls: ['./workspace-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceContainerComponent
  implements OnInit, OnDestroy, OnChanges {
  @Input() workspaceId: string;
  @Input() breadcrumb: Breadcrumb[];
  workspaceRuns: Run[];
  workspaceResources: Resource[];
  output: string[];
  isStateView$: Observable<boolean>;
  workspaceView$: Observable<string>;
  loading$: Observable<boolean>;
  expandedRunIds$: Observable<string[]>;
  expandedResourceIds$: Observable<string[]>;
  selectedRunIds$: Observable<any>;
  resourceActionIds$: Observable<string[]>;
  resourceAction$: Observable<ResourceActions>;
  workspaceRuns$: Observable<Run[]>;
  workspaceResources$: Observable<Resource[]>;
  workspace$: Observable<Workspace>;
  statusFilter$: Observable<StatusFilter[]>;
  breadcrumbString = '';
  resourceActions = ResourceActions;
  forceCancel = false;

  @ViewChild('importResourceDialog')
  importResourceDialog: TemplateRef<ImportResourceComponent>;
  private importResourceDialogRef: MatDialogRef<ImportResourceComponent>;

  @ViewChild('errorDialog')
  errorDialog: TemplateRef<OutputComponent>;
  private errorDialogRef: MatDialogRef<OutputComponent>;
  private errorMessage: string;

  constructor(
    private workspaceService: WorkspaceService,
    private workspaceQuery: WorkspaceQuery,
    private signalrService: SignalRService,
    private confirmService: ConfirmDialogService,
    private currentUserQuery: CurrentUserQuery,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loading$ = this.workspaceQuery.selectLoading().pipe(shareReplay(1));
    this.workspace$ = this.workspaceQuery.selectEntity(this.workspaceId);
    this.workspaceRuns$ = this.workspaceQuery
      .workspaceRuns$(this.workspaceId)
      .pipe(tap((runs) => (this.workspaceRuns = runs)));
    this.workspaceResources$ = this.workspaceQuery
      .workspaceResources$(this.workspaceId)
      .pipe(
        tap((resources) => {
          this.workspaceResources = resources;
        })
      );
    this.expandedRunIds$ = this.workspaceQuery
      .expandedRuns$(this.workspaceId)
      .pipe(
        tap(() => console.log(`Updating expandedRunIds`)),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    this.expandedResourceIds$ = this.workspaceQuery
      .expandedResources$(this.workspaceId)
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.selectedRunIds$ = this.workspaceQuery.selectedRuns$(this.workspaceId);
    this.resourceActionIds$ = this.workspaceQuery
      .resourceActions$(this.workspaceId)
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.resourceAction$ = this.workspaceQuery
      .resourceAction$(this.workspaceId)
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    this.statusFilter$ = this.workspaceQuery.filters$(this.workspaceId);
    // This value is used in multiple times in the template. So we use the shareReplay() operator to prevent multiple
    // subscriptions.
    this.workspaceView$ = this.workspaceQuery
      .getWorkspaceView(this.workspaceId)
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));

    this.signalrService.joinWorkspace(this.workspaceId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.breadcrumb && this.breadcrumb.length > 0) {
      this.breadcrumbString = '';
      this.breadcrumb.forEach((bc) => {
        this.breadcrumbString = this.breadcrumbString + '  >  ' + bc.name;
      });
    }
  }

  plan(event: Event) {
    event.stopPropagation();
    this.workspaceService
      .createPlanRun(this.workspaceId, false)
      .pipe(
        take(1)
        // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      )
      .subscribe();
  }

  reject(event: Event, run: Run) {
    event.stopPropagation();
    this.workspaceService
      .rejectRun(this.workspaceId, run.id)
      .pipe(
        take(1)
        // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      )
      .subscribe();
  }

  cancel(event: Event, run: Run) {
    event.stopPropagation();

    let message = `Are you sure you want to cancel this Run? Data loss may occur.`;

    if (this.forceCancel) {
      message = `Are you sure you want to forcefully cancel this Run? Data loss WILL occur.`;
    }

    this.confirmService
      .confirmDialog('Confirm Cancel', message)
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[this.confirmService.WAS_CANCELLED]) {
          this.workspaceService
            .cancelRun(this.workspaceId, run.id, this.forceCancel)
            .pipe(
              take(1)
              // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
            )
            .subscribe();
        }
      });
  }

  apply(event: Event, run: Run) {
    event.stopPropagation();
    // TODO: Unsubscribe from this.
    this.workspaceService.applyRun(this.workspaceId, run.id).pipe().subscribe();
  }

  destroy(event: Event) {
    event.stopPropagation();
    // TODO: Unsubscribe from this.
    this.workspaceService.createPlanRun(this.workspaceId, true).subscribe();
  }

  saveState(event: Event, run: Run) {
    event.stopPropagation();
    this.workspaceService
      .saveState(run.id)
      .pipe(
        take(1)
        // tslint:disable-next-line: rxjs-prefer-angular-takeuntil
      )
      .subscribe();
  }

  taint(event: Event, item: Resource) {
    event.stopPropagation();
    this.workspaceService
      .taint(this.workspaceId, item)
      .pipe(take(1))
      .subscribe((result) => {
        this.showResult(result);
      });
  }

  untaint(event: Event, item: Resource) {
    event.stopPropagation();
    this.workspaceService
      .untaint(this.workspaceId, item)
      .pipe(take(1))
      .subscribe((result) => {
        this.showResult(result);
      });
  }

  remove(event: Event, item: Resource) {
    event.stopPropagation();
    this.confirmService
      .confirmDialog(
        'Confirm Remove',
        `Are you sure you want to remove ${item.name}? This will only remove it from the Workspace State. It will NOT change any infrastructure.`
      )
      .pipe(take(1))
      .subscribe((result) => {
        if (!result[this.confirmService.WAS_CANCELLED]) {
          this.workspaceService
            .remove(this.workspaceId, item)
            .pipe(take(1))
            .subscribe((result) => {
              this.showResult(result);
            });
        }
      });
  }

  refreshResources() {
    this.workspaceService
      .refreshResources(this.workspaceId)
      .pipe(take(1))
      .subscribe((result) => {
        this.showResult(result);
      });
  }

  private showResult(result: ResourceCommandResult) {
    if (result.errors.length > 0) {
      this.errorMessage = '';
      result.errors.forEach((e) => (this.errorMessage += `${e}\n`));
      this.dialog.open(this.errorDialog, { width: '75%' });
    }
  }

  openImportResourceDialog() {
    this.importResourceDialogRef = this.dialog.open(this.importResourceDialog, {
      width: '75%',
    });
  }

  expandRun(event) {
    const { expand, item } = event;
    this.workspaceService.expandRun(expand, item);
  }

  expandResource(event) {
    const { expand, item } = event;
    this.workspaceService.updateResource(this.workspaceId, item);
    this.workspaceService.expandResource(expand, this.workspaceId, item);
  }

  enablePlanApply(): boolean {
    if (this.workspaceRuns === undefined) {
      return true;
    }
    if (this.workspaceRuns.length === 0) {
      return true;
    }

    const alreadyHasOne = this.workspaceRuns.some((run) => {
      if (
        run.status === RunStatus.Queued ||
        run.status === RunStatus.Planning ||
        run.status === RunStatus.Planned ||
        run.status === RunStatus.Applying ||
        run.status === RunStatus.AppliedStateError ||
        run.status === RunStatus.FailedStateError
      ) {
        return true;
      } else {
        return false;
      }
    });
    return !alreadyHasOne;
  }

  hasPlan(run?: Run) {
    return this.hasStatus(RunStatus.Planned, run);
  }

  hasStateError(run?: Run) {
    return (
      this.hasStatus(RunStatus.AppliedStateError, run) ||
      this.hasStatus(RunStatus.FailedStateError, run)
    );
  }

  isCancelable(run?: Run) {
    return (
      this.hasStatus(RunStatus.Planning, run) ||
      this.hasStatus(RunStatus.Applying, run)
    );
  }

  private hasStatus(status: RunStatus, run?: Run) {
    if (run) {
      return run.status === status ? true : false;
    } else {
      if (this.workspaceRuns && this.workspaceRuns.length > 0) {
        const result = this.workspaceRuns.filter(() => run.status === status);
        return result.length > 0 ? true : false;
      } else {
        return true;
      }
    }
  }

  filterRuns(filters: StatusFilter[]) {
    this.workspaceService.setStatusFilters(this.workspaceId, filters);
  }

  setRowStyle = (item: Run | Resource) => {
    if (!item) {
      return {};
    }
    if ('isDestroy' in item) {
      return item.isDestroy ? 'isDestroy' : '';
    }
    if ('tainted' in item) {
      return item.tainted ? 'isDestroy' : '';
    }
  };

  viewChangedFn(event) {
    if (event) {
      switch (event) {
        case 'runs':
          this.workspaceService
            .loadRunsByWorkspaceId(this.workspaceId)
            .pipe(take(1))
            .subscribe();
          break;
        case 'state':
          this.workspaceService
            .loadResourcesByWorkspaceId(this.workspaceId)
            .pipe(take(1))
            .subscribe();
          break;
      }
      this.workspaceService.setWorkspaceView(this.workspaceId, event);
    }
  }

  planOutput(output: string, item: Run) {
    this.workspaceService.planOutputUpdated(item.workspaceId, item.id, output);
  }

  applyOutput(output: string, item: Run) {
    this.workspaceService.applyOutputUpdated(item.workspaceId, item.id, output);
  }

  onImportComplete() {
    this.importResourceDialogRef.close();
  }

  ngOnDestroy() {
    this.signalrService.leaveWorkspace(this.workspaceId);
  }
}
