// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule, Routes } from '@angular/router';
import { ComnAuthGuardService } from '@cmusei/crucible-common';
import { ResizableModule } from 'angular-resizable-element';
import { CanDeactivateGuard } from 'src/app/sei-cwd-common/cwd-route-guards/can-deactivate.guard';
import { DesignModule } from '../designs/design.module';
import { DirectoriesModule } from '../directories';
import { EditorModule } from '../editor/editor.module';
import { CwdToolbarModule } from '../sei-cwd-common/cwd-toolbar';
import { SeiCwdCommonModule } from '../sei-cwd-common/sei-cwd-common.module';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { ProjectBreadcrumbComponent } from './component/project-details/project-breadcrumb/project-breadcrumb.component';
import { ProjectCollapseContainerComponent } from './component/project-details/project-collapse-container/project-collapse-container.component';
import { ProjectExportComponent } from './component/project-details/project-export/project-export.component';
import { DirectoryPanelComponent } from './component/project-details/project-navigation-container/directory-panel/directory-panel.component';
import { ProjectNavigationContainerComponent } from './component/project-details/project-navigation-container/project-navigation-container.component';
import { ProjectTabComponent } from './component/project-details/project-tab/project-tab.component';
import { ProjectComponent } from './component/project-details/project/project.component';
import { ProjectListContainerComponent } from './component/project-home/project-list-container/project-list-container.component';
import { ProjectListComponent } from './component/project-home/project-list/project-list.component';
import { FilesFilterPipe } from './pipes/files-filter-pipe';
import { ProjectMembershipsComponent } from './component/project-memberships/project-memberships/project-memberships.component';
import { ProjectMembershipsPageComponent } from './component/project-memberships/project-memberships-page/project-memberships-page.component';
import { ProjectMembershipListComponent } from './component/project-memberships/project-membership-list/project-membership-list.component';
import { ProjectMemberListComponent } from './component/project-memberships/project-member-list/project-member-list.component';
import { ClipboardModule } from 'ngx-clipboard';
import { MatSnackBarModule } from '@angular/material/snack-bar';

const projectRoutes: Routes = [
  {
    path: 'projects',
    component: ProjectListContainerComponent,
    canActivate: [ComnAuthGuardService],
  },
  {
    path: 'projects/:id',
    component: ProjectCollapseContainerComponent,
    canActivate: [ComnAuthGuardService],
    canDeactivate: [CanDeactivateGuard],
  },
];

@NgModule({
  declarations: [
    ProjectComponent,
    ProjectListComponent,
    ProjectListContainerComponent,
    ProjectNavigationContainerComponent,
    ProjectCollapseContainerComponent,
    DirectoryPanelComponent,
    ProjectBreadcrumbComponent,
    ProjectTabComponent,
    FilesFilterPipe,
    ProjectExportComponent,
    ProjectMembershipsComponent,
    ProjectMembershipsPageComponent,
    ProjectMembershipListComponent,
    ProjectMemberListComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(projectRoutes),
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    FlexLayoutModule,
    MatButtonModule,
    MatSortModule,
    MatTooltipModule,
    MatTabsModule,
    RouterModule,
    ResizableModule,
    CwdToolbarModule,
    DirectoriesModule,
    WorkspaceModule,
    MatButtonToggleModule,
    MatExpansionModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatBadgeModule,
    MatDialogModule,
    EditorModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatToolbarModule,
    SharedModule,
    SeiCwdCommonModule,
    DesignModule,
    ClipboardModule,
    MatSnackBarModule,
  ],
  exports: [
    ProjectComponent,
    ProjectListContainerComponent,
    ProjectNavigationContainerComponent,
    ProjectBreadcrumbComponent,
    ProjectTabComponent,
    ProjectListComponent,
    ProjectMembershipsComponent,
  ],
})
export class ProjectModule {}
