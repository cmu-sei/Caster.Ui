// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ComnAuthQuery,
  ComnSettingsService,
  Theme,
} from '@cmusei/crucible-common';
import { combineLatest, Observable, Subject } from 'rxjs';
import { filter, map, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { DesignQuery } from 'src/app/designs/state/design.query';
import { WorkspaceQuery } from 'src/app/workspace/state';
import { FileQuery, isFileContentChanged } from 'src/app/files/state';
import { Project, ProjectPermission } from 'src/app/generated/caster-api';
import { CanComponentDeactivate } from 'src/app/sei-cwd-common/cwd-route-guards/can-deactivate.guard';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import {
  CurrentUserQuery,
  CurrentUserState,
  UserService,
} from 'src/app/users/state';
import {
  ProjectObjectType,
  ProjectQuery,
  ProjectService,
  ProjectUI,
} from '../../../state';
import { TopbarView } from './../../../../shared/components/top-bar/topbar.models';
import { PermissionService } from 'src/app/permissions/permission.service';
import {
  MatSidenavContainer,
  MatSidenav,
  MatSidenavContent,
} from '@angular/material/sidenav';
import {
  ResizableDirective,
  ResizeHandleDirective,
} from 'angular-resizable-element';
import { MatToolbar } from '@angular/material/toolbar';
import { MatIcon } from '@angular/material/icon';
import { ProjectNavigationContainerComponent } from '../project-navigation-container/project-navigation-container.component';
import { MatDivider } from '@angular/material/list';
import { TopbarComponent } from '../../../../shared/components/top-bar/topbar.component';
import { ProjectComponent } from '../project/project.component';
import { AsyncPipe } from '@angular/common';
import { InventoryPanelComponent } from 'src/app/inventory/components/inventory-panel/inventory-panel.component';
import { ProjectAiUsageComponent } from '../project-ai-usage/project-ai-usage.component';
import { ProjectAssistantComponent } from '../project-assistant/project-assistant.component';
import { MatButton } from '@angular/material/button';

const LEFT_SIDEBAR_MIN_WIDTH = 250;
const ASSISTANT_DEFAULT_WIDTH = 440;
const ASSISTANT_MIN_WIDTH = 320;
// never so wide the tabs have no room
const ASSISTANT_MAX_VIEWPORT_SHARE = 0.8;
const ASSISTANT_WIDTH_KEY = 'caster.askAiPanelWidth';

@Component({
  selector: 'cas-project-collapse-container',
  templateUrl: './project-collapse-container.component.html',
  styleUrls: ['./project-collapse-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatSidenavContainer,
    MatSidenav,
    ResizableDirective,
    MatToolbar,
    RouterLink,
    MatIcon,
    ProjectNavigationContainerComponent,
    MatDivider,
    ResizeHandleDirective,
    MatSidenavContent,
    TopbarComponent,
    ProjectComponent,
    InventoryPanelComponent,
    ProjectAiUsageComponent,
    ProjectAssistantComponent,
    MatButton,
    AsyncPipe,
  ],
})
export class ProjectCollapseContainerComponent
  implements OnInit, OnDestroy, CanComponentDeactivate
{
  private projectQuery = inject(ProjectQuery);
  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  private authQuery = inject(ComnAuthQuery);
  private currentUserQuery = inject(CurrentUserQuery);
  private settingsService = inject(ComnSettingsService);
  private fileQuery = inject(FileQuery);
  private workspaceQuery = inject(WorkspaceQuery);
  private designQuery = inject(DesignQuery);
  private signalRService = inject(SignalRService);
  private permissionService = inject(PermissionService);
  private router = inject(Router);

  public project$: Observable<Project>;
  public project: Project;
  public projectUI$: Observable<ProjectUI>;
  private projectUI: ProjectUI;
  public loading$: Observable<boolean>;
  public leftSidebarOpen: boolean;
  public leftSidebarWidth: number;
  public currentUser$: Observable<CurrentUserState>;
  public titleText = 'Caster';
  public theme$: Observable<Theme>;
  /** Ask AI changes files, so it is offered to whoever may edit the project. */
  public canEditProject$: Observable<boolean>;
  /** Whether the Ask AI panel is open; it stays open across the project's tabs. */
  readonly assistantOpen = signal(false);
  /** How wide the Ask AI panel is; the planner drags its left edge to change it. */
  readonly assistantWidth = signal(
    this.clampAssistantWidth(
      Number(localStorage.getItem(ASSISTANT_WIDTH_KEY)) ||
        ASSISTANT_DEFAULT_WIDTH,
    ),
  );
  /** The directory and workspace of the open tab, which Ask AI starts on. */
  readonly assistantScope = signal<{
    directoryId?: string;
    workspaceId?: string;
  }>({});

  TopbarView = TopbarView;

  private unsubscribe$ = new Subject();

  constructor() {
    this.theme$ = this.currentUserQuery.userTheme$;
  }

  ngOnInit() {
    this.loading$ = this.projectQuery.selectLoading();
    this.project$ = this.projectQuery.selectActive();
    this.projectUI$ = this.projectQuery.ui.selectActive();
    this.projectUI$.pipe(takeUntil(this.unsubscribe$)).subscribe((exUi) => {
      this.projectUI = exUi;
      this.assistantScope.set(this.scopeOf(exUi));
    });
    this.canEditProject$ = this.project$.pipe(
      filter((p) => !!p),
      switchMap((p) => this.permissionService.canEditProject(p.id)),
    );

    this.currentUser$ = this.currentUserQuery.select();
    this.userService.setCurrentUser();

    // Set the page title from configuration file
    this.titleText = this.settingsService.settings.AppTopBarText;

    this.project$
      .pipe(
        // Sometimes the project variable is undefined. We filter for those since were dependent on the project object.
        filter((p) => p !== undefined),
        // Use switchMap to get the value of project.id since sidebar properties are dependant.
        switchMap((p: Project) => {
          return combineLatest(
            this.projectQuery.getLeftSidebarOpen(p.id),
            this.projectQuery.getLeftSidebarWidth(p.id),
            // Use a results selector to return all 3 values.
            (open: boolean, width: number) => {
              return { p, open, width };
            },
          );
        }),
        // set the values of the sidebar without affecting the subscription.
        tap(({ p, open, width }) => {
          this.leftSidebarOpen = open;
          this.leftSidebarWidth = width;
        }),
        takeUntil(this.unsubscribe$),
      )
      .subscribe(({ p, open, width }) => {
        if (p) {
          this.project = p;
          this.permissionService
            .loadProjectPermissions(p.id)
            .pipe(take(1))
            .subscribe();
          this.signalRService
            .startConnection()
            .then(() => {
              this.signalRService.joinProject(p.id);
            })
            .catch((err) => {
              console.log(err);
            });
        }
      });
  }

  // the open tab's directory, and its workspace when it is one
  private scopeOf(ui: ProjectUI): {
    directoryId?: string;
    workspaceId?: string;
  } {
    const tab = ui?.openTabs?.[ui.selectedTab];
    switch (tab?.type) {
      case ProjectObjectType.FILE:
        return { directoryId: this.fileQuery.getEntity(tab.id)?.directoryId };
      case ProjectObjectType.WORKSPACE:
        return {
          directoryId: this.workspaceQuery.getEntity(tab.id)?.directoryId,
          workspaceId: tab.id,
        };
      case ProjectObjectType.DESIGN:
        return { directoryId: this.designQuery.getEntity(tab.id)?.directoryId };
      default:
        return {};
    }
  }

  closeTab(id: string) {
    this.projectService.closeTab(id);
  }

  tabChangedFn({ index, tab }) {
    this.projectService.setSelectedTab(index);
  }

  resizingFn(event) {
    const width =
      event.rectangle.width >= LEFT_SIDEBAR_MIN_WIDTH
        ? event.rectangle.width
        : LEFT_SIDEBAR_MIN_WIDTH;
    this.leftSidebarWidth = width;
  }

  /** The Ask AI panel's width, within what the window allows. */
  private clampAssistantWidth(width: number): number {
    const max = Math.max(
      ASSISTANT_MIN_WIDTH,
      Math.floor(window.innerWidth * ASSISTANT_MAX_VIEWPORT_SHARE),
    );
    return Math.min(Math.max(width, ASSISTANT_MIN_WIDTH), max);
  }

  assistantResizingFn(event: { rectangle: { width?: number } }) {
    this.assistantWidth.set(
      this.clampAssistantWidth(
        event.rectangle.width ?? ASSISTANT_DEFAULT_WIDTH,
      ),
    );
  }

  assistantResizeEndFn(event: { rectangle: { width?: number } }) {
    this.assistantResizingFn(event);
    // kept for the next page and visit, as a window setting, not a project's
    localStorage.setItem(ASSISTANT_WIDTH_KEY, String(this.assistantWidth()));
  }

  resizeEndFn(event) {
    const width =
      event.rectangle.width >= LEFT_SIDEBAR_MIN_WIDTH
        ? event.rectangle.width
        : LEFT_SIDEBAR_MIN_WIDTH;
    this.projectService.setLeftSidebarWidth(this.project.id, width);
  }

  leftSidebarOpenFn(event) {
    this.projectService.setLeftSidebarOpen(this.project.id, event);
  }

  isFileContentChanged(fileId: string): boolean {
    return isFileContentChanged(this.fileQuery.getEntity(fileId));
  }

  openEditMemberships() {}

  goToHome(): void {
    this.router.navigate(['/']);
  }

  // @HostListener handles browser refresh, close, etc.
  @HostListener('window:beforeunload')
  canDeactivate(): Observable<boolean> | Promise<boolean> | boolean {
    // check if there are pending changes
    // returning true will navigate without confirmation
    // returning false will show a confirm dialog before navigating away
    if (!this.projectUI || !this.projectUI.openTabs) {
      return true;
    }
    const thereAreUnsavedChanges = this.projectUI.openTabs.some((tab) => {
      return (
        tab.type === ProjectObjectType.FILE && this.isFileContentChanged(tab.id)
      );
    });
    return !thereAreUnsavedChanges;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(null);
    this.unsubscribe$.complete();
    const activeProject = this.projectQuery.getActive();
    if (activeProject) {
      this.signalRService.leaveProject(activeProject.id);
    }
  }
}
