// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AdminContainerComponent } from './component/admin-container/admin-container.component';
import { UsersComponent } from './component/admin-users/users.component';
import { UserListComponent } from './component/admin-users/user-list/user-list.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { RouterModule } from '@angular/router';
import { ClipboardModule } from 'ngx-clipboard';
import { AdminModuleListComponent } from './component/admin-modules/modules-list/module-list.component';
import { AdminModulesComponent } from './component/admin-modules/modules.component';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { MatSliderModule } from '@angular/material/slider';
import { VlanListComponent } from './component/admin-vlans/vlan-list/vlan-list.component';
import { MatTableModule } from '@angular/material/table';
import { TableVirtualScrollModule } from 'ng-table-virtual-scroll';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { MatSelectModule } from '@angular/material/select';
import { PoolsComponent } from './component/admin-vlans/pools/pools.component';
import { ProjectVlansComponent } from './component/admin-vlans/project-vlans/project-vlans.component';
import { MatTabsModule } from '@angular/material/tabs';
import { PoolListItemComponent } from './component/admin-vlans/pool-list-item/pool-list-item.component';
import { AdminAppRoutingModule } from './admin-app-routing.module';
import { SharedModule } from '../shared/shared.module';
import { AdminRolesComponent } from './component/admin-roles/admin-roles.component';
import { AdminGroupsComponent } from './component/admin-groups/admin-groups.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialogModule } from '@angular/material/dialog';
import { DialogModule } from '@angular/cdk/dialog';
import { AdminGroupsDetailComponent } from './component/admin-groups/admin-groups-detail/admin-groups-detail.component';
import { AdminGroupsMembershipListComponent } from './component/admin-groups/admin-groups-membership-list/admin-groups-membership-list.component';
import { AdminGroupsMemberListComponent } from './component/admin-groups/admin-groups-member-list/admin-groups-member-list.component';

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
  ],
  imports: [
    ClipboardModule,
    CommonModule,
    SharedModule,
    RouterModule,
    FlexLayoutModule,
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
  ],
  exports: [AdminContainerComponent, UsersComponent, UserListComponent],
})
export class AdminAppModule {}
