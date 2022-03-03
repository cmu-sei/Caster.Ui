// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { ComnAuthService, ComnSettingsService } from '@cmusei/crucible-common';
import * as signalR from '@microsoft/signalr';
import { DesignModuleService } from 'src/app/designs/state/design-modules/design-module.service';
import { DesignService } from 'src/app/designs/state/design.service';
import { VariableService } from 'src/app/designs/state/variables/variables.service';
import { DirectoryService } from 'src/app/directories';
import { FileService } from 'src/app/files/state';
import {
  Design,
  DesignModule,
  Directory,
  ModelFile,
  Run,
  Variable,
  Workspace,
} from 'src/app/generated/caster-api';
import { WorkspaceService } from 'src/app/workspace/state';
import { ProjectService } from '../../project/state';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private hubConnection: signalR.HubConnection;
  private projectId: string;
  private workspaceIds: string[] = [];
  private designIds: string[] = [];
  private joinedWorkspacesAdmin = false;
  private connectionPromise: Promise<void>;

  constructor(
    private fileService: FileService,
    private projectService: ProjectService,
    private directoryService: DirectoryService,
    private workspaceService: WorkspaceService,
    private authService: ComnAuthService,
    private settingsService: ComnSettingsService,
    private designService: DesignService,
    private variableService: VariableService,
    private designModuleService: DesignModuleService
  ) {}

  public startConnection(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.settingsService.settings.ApiUrl}/hubs/project`, {
        accessTokenFactory: () => {
          return this.authService.getAuthorizationToken();
        },
      })
      .withAutomaticReconnect(new RetryPolicy(60, 0, 5))
      .build();

    this.hubConnection.onreconnected(() => {
      this.JoinGroups();
    });

    this.addHandlers();
    this.connectionPromise = this.hubConnection.start();
    this.connectionPromise.then((x) => this.JoinGroups());

    return this.connectionPromise;
  }

  private JoinGroups() {
    if (this.projectId) {
      this.joinProject(this.projectId);
    }

    if (this.workspaceIds) {
      this.workspaceIds.forEach((x) => this.joinWorkspace(x));
    }

    if (this.joinedWorkspacesAdmin) {
      this.joinWorkspacesAdmin();
    }

    if (this.designIds) {
      this.designIds.forEach((x) => this.joinDesign(x));
    }
  }

  public joinProject(projectId: string) {
    this.projectId = projectId;

    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinProject', projectId);
    }
  }

  public leaveProject(projectId: string) {
    this.projectId = null;
    this.hubConnection.invoke('LeaveProject', projectId);
  }

  public joinWorkspace(workspaceId: string) {
    this.workspaceIds.push(workspaceId);

    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinWorkspace', workspaceId);
    }
  }

  public leaveWorkspace(workspaceId: string) {
    this.workspaceIds = this.workspaceIds.filter((x) => x !== workspaceId);
    this.hubConnection.invoke('LeaveWorkspace', workspaceId);
  }

  public joinWorkspacesAdmin() {
    this.joinedWorkspacesAdmin = true;

    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinWorkspacesAdmin');
    }
  }

  public leaveWorkspacesAdmin() {
    this.joinedWorkspacesAdmin = false;
    this.hubConnection.invoke('LeaveWorkspacesAdmin');
  }

  public joinDesign(designId: string) {
    this.designIds.push(designId);

    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinDesign', designId);
    }
  }

  public leaveDesign(designId: string) {
    this.designIds = this.designIds.filter((x) => x !== designId);
    this.hubConnection.invoke('LeaveDesign', designId);
  }

  public streamPlanOutput(planId: string) {
    return this.hubConnection.stream('GetPlanOutput', planId);
  }

  public streamApplyOutput(applyId: string) {
    return this.hubConnection.stream('GetApplyOutput', applyId);
  }

  private addHandlers() {
    this.addFileHandlers();
    this.addDirectoryHandlers();
    this.addWorkspaceHandlers();
    this.addRunHandlers();
    this.addDesignHandlers();
    this.addVariableHandlers();
    this.addDesignModuleHandlers();
  }

  private addFileHandlers() {
    this.hubConnection.on('FileUpdated', (file: ModelFile) => {
      this.fileService.fileUpdated(file);
    });

    this.hubConnection.on('FileDeleted', (fileId: string) => {
      this.projectService.closeTab(fileId);
      this.fileService.fileDeleted(fileId);
    });
  }

  private addDirectoryHandlers() {
    this.hubConnection.on('DirectoryUpdated', (directory: Directory) => {
      this.directoryService.updated(directory);
    });

    this.hubConnection.on('DirectoryDeleted', (dirId: string) => {
      this.directoryService.deleted(dirId);
    });
  }

  private addWorkspaceHandlers() {
    this.hubConnection.on('WorkspaceUpdated', (workspace: Workspace) => {
      this.workspaceService.updated(workspace);
    });

    this.hubConnection.on('WorkspaceDeleted', (workspaceId: string) => {
      this.workspaceService.deleted(workspaceId);
    });

    this.hubConnection.on(
      'WorkspaceSettingsUpdated',
      (lockingEnabled: boolean) => {
        this.workspaceService.lockingEnabledUpdated(lockingEnabled);
      }
    );
  }

  private addRunHandlers() {
    this.hubConnection.on('RunUpdated', (run: Run) => {
      this.workspaceService.runUpdated(run);
    });
  }

  private addDesignHandlers() {
    this.hubConnection.on('DesignCreated', (design: Design) => {
      this.designService.add(design);
    });

    this.hubConnection.on(
      'DesignUpdated',
      (design: Design, modifiedProperties: string[]) => {
        this.designService.update(
          design.id,
          this.getModified(design, modifiedProperties)
        );
      }
    );

    this.hubConnection.on('DesignDeleted', (id: string) => {
      this.designService.remove(id);
    });
  }

  private addVariableHandlers() {
    this.hubConnection.on('VariableCreated', (variable: Variable) => {
      this.variableService.add(variable);
    });

    this.hubConnection.on(
      'VariableUpdated',
      (variable: Variable, modifiedProperties: string[]) => {
        this.variableService.update(
          variable.id,
          this.getModified(variable, modifiedProperties)
        );
      }
    );

    this.hubConnection.on('VariableDeleted', (id: string) => {
      this.variableService.remove(id);
    });
  }

  private addDesignModuleHandlers() {
    this.hubConnection.on(
      'DesignModuleCreated',
      (designModule: DesignModule) => {
        this.designModuleService.add(designModule);
      }
    );

    this.hubConnection.on(
      'DesignModuleUpdated',
      (designModule: DesignModule, modifiedProperties: string[]) => {
        this.designModuleService.update(
          designModule.id,
          this.getModified(designModule, modifiedProperties)
        );
      }
    );

    this.hubConnection.on('DesignModuleDeleted', (id: string) => {
      this.designModuleService.remove(id);
    });
  }

  private getModified(entity: any, modifiedProperties: string[]): any {
    if (modifiedProperties == null) {
      return entity;
    }

    const retVal = {};
    modifiedProperties.forEach((x) => {
      retVal[x] = entity[x];
    });

    return retVal;
  }
}

class RetryPolicy {
  constructor(
    private maxSeconds: number,
    private minJitterSeconds: number,
    private maxJitterSeconds: number
  ) {}

  nextRetryDelayInMilliseconds(
    retryContext: signalR.RetryContext
  ): number | null {
    let nextRetrySeconds = Math.pow(2, retryContext.previousRetryCount + 1);

    if (nextRetrySeconds > this.maxSeconds) {
      nextRetrySeconds = this.maxSeconds;
    }

    nextRetrySeconds +=
      Math.floor(
        Math.random() * (this.maxJitterSeconds - this.minJitterSeconds + 1)
      ) + this.minJitterSeconds; // Add Jitter

    return nextRetrySeconds * 1000;
  }
}
