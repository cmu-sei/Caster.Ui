// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminContainerComponent } from './component/admin-container/admin-container.component';
import { UsersComponent } from './component/admin-users/users.component';
import { UserListComponent } from './component/admin-users/user-list/user-list.component';
import { RouterModule } from '@angular/router';
import { ClipboardModule } from 'ngx-clipboard';
import { AdminModuleListComponent } from './component/admin-modules/modules-list/module-list.component';
import { AdminModulesComponent } from './component/admin-modules/modules.component';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyPaginatorModule as MatPaginatorModule } from '@angular/material/legacy-paginator';
import { MatLegacyProgressBarModule as MatProgressBarModule } from '@angular/material/legacy-progress-bar';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { AdminWorkspacesComponent } from './component/admin-workspaces/admin-workspaces.component';
import { LockingStatusComponent } from './component/admin-workspaces/locking-status/locking-status.component';
import { ActiveRunsComponent } from './component/admin-workspaces/active-runs/active-runs.component';
import { CwdTableModule } from '../sei-cwd-common/cwd-table/cwd-table.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { VlansComponent } from './component/admin-vlans/vlans.component';
import { PoolListComponent } from './component/admin-vlans/pool-list/pool-list.component';
import { PartitionListComponent } from './component/admin-vlans/partition-list/partition-list.component';
import { PartitionComponent } from './component/admin-vlans/partition/partition.component';
import { MatLegacySliderModule as MatSliderModule } from '@angular/material/legacy-slider';
import { VlanListComponent } from './component/admin-vlans/vlan-list/vlan-list.component';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { TableVirtualScrollModule } from 'ng-table-virtual-scroll';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { PoolsComponent } from './component/admin-vlans/pools/pools.component';
import { ProjectVlansComponent } from './component/admin-vlans/project-vlans/project-vlans.component';
import { MatLegacyTabsModule as MatTabsModule } from '@angular/material/legacy-tabs';
import { PoolListItemComponent } from './component/admin-vlans/pool-list-item/pool-list-item.component';
import { AdminAppRoutingModule } from './admin-app-routing.module';
import { SharedModule } from '../shared/shared.module';
import { AdminRolesComponent } from './component/admin-roles/admin-roles.component';
import { AdminGroupsComponent } from './component/admin-groups/admin-groups.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { AdminGroupsDetailComponent } from './component/admin-groups/admin-groups-detail/admin-groups-detail.component';
import { AdminGroupsMembershipListComponent } from './component/admin-groups/admin-groups-membership-list/admin-groups-membership-list.component';
import { AdminGroupsMemberListComponent } from './component/admin-groups/admin-groups-member-list/admin-groups-member-list.component';
import { AdminProjectsComponent } from './component/admin-projects/admin-projects.component';
import { ProjectModule } from '../project';
import { SystemRolesComponent } from './component/admin-roles/system-roles/system-roles.component';
import { ProjectRolesComponent } from './component/admin-roles/project-roles/project-roles/project-roles.component';

@NgModule({
  declarations: [
    AdminContainerComponent,
    AdminModuleListComponent,
    AdminModulesComponent,
    UsersComponent,
    UserListComponent,
    AdminWorkspacesComponent,
    LockingStatusComponent,
    ActiveRunsComponent,
    VlansComponent,
    PoolListComponent,
    PartitionListComponent,
    PartitionComponent,
    VlanListComponent,
    PoolsComponent,
    ProjectVlansComponent,
    PoolListItemComponent,
    AdminRolesComponent,
    AdminGroupsComponent,
    AdminGroupsDetailComponent,
    AdminGroupsMembershipListComponent,
    AdminGroupsMemberListComponent,
    AdminProjectsComponent,
    SystemRolesComponent,
    ProjectRolesComponent,
  ],
  imports: [
    ClipboardModule,
    CommonModule,
    SharedModule,
    RouterModule,
    FormsModule,
    CwdTableModule,
    WorkspaceModule,
    ScrollingModule,
    TableVirtualScrollModule,
    AdminAppRoutingModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatSlideToggleModule,
    MatSortModule,
    MatTooltipModule,
    MatTreeModule,
    MatSelectModule,
    MatTabsModule,
    MatSliderModule,
    MatTableModule,
    MatToolbarModule,
    MatDialogModule,
    ProjectModule,
    ReactiveFormsModule,
  ],
  exports: [AdminContainerComponent, UsersComponent, UserListComponent],
})
export class AdminAppModule {}
