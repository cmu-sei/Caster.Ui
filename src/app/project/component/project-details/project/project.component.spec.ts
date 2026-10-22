// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Project } from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { initialProjectUIState } from '../../../state/project-store.service';
import { ProjectUI } from '../../../state/project.model';
import { ProjectComponent } from './project.component';

@Component({ selector: 'cas-project-tab', template: '', standalone: false })
class ProjectTabStub {
  @Input() project: Project;
  @Input() projectUI: ProjectUI;
  @Output() closeTab = new EventEmitter<string>();
  @Output() tabChanged = new EventEmitter<unknown>();
}

describe('ProjectComponent', () => {
  /**
   * Verifies: the project and its UI state reach the tab view, and a closed tab is re-emitted.
   * Interacts with: the cas-project-tab stub's inputs and closeTab output.
   * Data: project p1; tab t1 closed.
   */
  it('passes the project to its tabs and forwards closeTab', async () => {
    const closeTab = vi.fn<(id: string) => void>();
    const project: Project = { id: 'p1', name: 'Range' };
    const projectUI: ProjectUI = { ...initialProjectUIState, id: 'p1' };
    const { fixture } = await renderComponent(ProjectComponent, {
      declarations: [ProjectTabStub],
      inputs: { project, projectUI, loading: false },
      on: { closeTab },
    });

    const tab: ProjectTabStub = fixture.debugElement.query(
      By.directive(ProjectTabStub),
    ).componentInstance;
    expect(tab.project).toBe(project);
    expect(tab.projectUI).toBe(projectUI);
    tab.closeTab.emit('t1');
    expect(closeTab).toHaveBeenCalledWith('t1');
  });
});
