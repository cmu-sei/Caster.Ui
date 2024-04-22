// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { WorkspaceService, WorkspaceQuery } from '../../state';
import {
  TerraformService,
  TerraformVersionsResult,
  Workspace,
} from 'src/app/generated/caster-api';
import { Observable } from 'rxjs';

@Component({
  selector: 'cas-workspace-edit-container',
  templateUrl: './workspace-edit-container.component.html',
  styleUrls: ['./workspace-edit-container.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceEditContainerComponent implements OnInit {
  @Input() id: string;
  @Output() editWorkspaceComplete = new EventEmitter<boolean>();

  public workspace$: Observable<Workspace>;
  public versionResult$: Observable<TerraformVersionsResult>;
  public maxParallelism$: Observable<number>;

  constructor(
    private workspaceService: WorkspaceService,
    private workspaceQuery: WorkspaceQuery,
    private terraformService: TerraformService
  ) {}

  ngOnInit(): void {
    this.workspace$ = this.workspaceQuery.selectEntity(this.id);
    this.versionResult$ = this.terraformService.getTerraformVersions();
    this.maxParallelism$ = this.terraformService.getTerraformMaxParallelism();
  }

  onUpdateWorkspace(workspace: Partial<Workspace>) {
    if (workspace != null) {
      this.workspaceService.partialUpdate(this.id, workspace);
    }
    this.editWorkspaceComplete.emit(true);
  }
}
