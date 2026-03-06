// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { ResizableModule } from 'angular-resizable-element';
import { EditorComponent } from './editor.component';
import { ModuleListComponent } from '../module-list/module-list.component';
import { VersionListComponent } from '../version-list/version-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  FormsModule,
  MatToolbarModule,
  MatButtonModule,
  MatIconModule,
  MatSidenavModule,
  MatDividerModule,
  MatTooltipModule,
  MatButtonToggleModule,
  MatCardModule,
  MatInputModule,
  MonacoEditorModule.forRoot(),
  ResizableModule,
  SharedModule,
];

async function renderEditor(
  overrides: {
    fileId?: string;
    canEdit?: boolean;
    canAdminLock?: boolean;
  } = {}
) {
  return renderComponent(EditorComponent, {
    declarations: [EditorComponent, ModuleListComponent, VersionListComponent],
    imports: sharedImports,
    componentProperties: {
      fileId: overrides.fileId ?? 'test-file-id',
      canEdit: overrides.canEdit ?? false,
      canAdminLock: overrides.canAdminLock ?? false,
      sidebarOpen: false,
      sidebarView: '',
      breadcrumb: [],
      sidenavWidth: 300,
      modules: [],
    } as any,
  });
}

describe('EditorComponent', () => {
  // NOTE: Monaco Editor does not render in jsdom (no real DOM layout engine).
  // We test component creation and input/output bindings instead of Monaco-specific rendering.

  it('should create', async () => {
    const { fixture } = await renderEditor();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should accept fileId input', async () => {
    const { fixture } = await renderEditor({ fileId: 'my-file-123' });
    expect(fixture.componentInstance.fileId).toBe('my-file-123');
  });

  it('should accept canEdit input', async () => {
    const { fixture } = await renderEditor({ canEdit: true });
    expect(fixture.componentInstance.canEdit).toBe(true);
  });

  it('should accept canAdminLock input', async () => {
    const { fixture } = await renderEditor({ canAdminLock: true });
    expect(fixture.componentInstance.canAdminLock).toBe(true);
  });

  it('should default canEdit to false', async () => {
    const { fixture } = await renderEditor();
    expect(fixture.componentInstance.canEdit).toBe(false);
  });

  it('should default canAdminLock to false', async () => {
    const { fixture } = await renderEditor();
    expect(fixture.componentInstance.canAdminLock).toBe(false);
  });

  it('should have sidebarChanged output', async () => {
    const { fixture } = await renderEditor();
    expect(fixture.componentInstance.sidebarChanged).toBeTruthy();
  });

  it('should have sidebarViewChanged output', async () => {
    const { fixture } = await renderEditor();
    expect(fixture.componentInstance.sidebarViewChanged).toBeTruthy();
  });

  it('should have codeChanged output', async () => {
    const { fixture } = await renderEditor();
    expect(fixture.componentInstance.codeChanged).toBeTruthy();
  });

  it('should render toolbar', async () => {
    const { container } = await renderEditor();
    expect(container.querySelector('mat-toolbar')).toBeInTheDocument();
  });
});
