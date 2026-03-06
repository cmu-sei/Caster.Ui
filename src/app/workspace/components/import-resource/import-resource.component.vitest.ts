// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImportResourceComponent } from './import-resource.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { permissionProvider } from 'src/app/test-utils/mock-permission.service';
import { SystemPermission } from 'src/app/generated/caster-api';

const sharedImports = [
  ReactiveFormsModule,
  MatInputModule,
  MatButtonModule,
  MatTooltipModule,
  MatProgressSpinnerModule,
];

describe('ImportResourceComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(ImportResourceComponent, {
      declarations: [ImportResourceComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Import Resource heading', async () => {
    const { fixture } = await renderComponent(ImportResourceComponent, {
      declarations: [ImportResourceComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading?.textContent).toContain('Import Resource');
  });

  it('should have Address and Id form fields', async () => {
    const { fixture } = await renderComponent(ImportResourceComponent, {
      declarations: [ImportResourceComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    const component = fixture.componentInstance;
    expect(component.form.contains('address')).toBe(true);
    expect(component.form.contains('id')).toBe(true);
  });

  it('should have Import and Cancel buttons', async () => {
    const { fixture } = await renderComponent(ImportResourceComponent, {
      declarations: [ImportResourceComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b: any) => b.textContent.trim());
    expect(buttonTexts.some((t: string) => t.includes('Import'))).toBe(true);
    expect(buttonTexts.some((t: string) => t.includes('Cancel'))).toBe(true);
  });

  it('should disable Import button when form is invalid', async () => {
    const { fixture } = await renderComponent(ImportResourceComponent, {
      declarations: [ImportResourceComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitButton.disabled).toBe(true);
  });

  describe('ImportResources permission', () => {
    it('should render with ImportResources permission', async () => {
      const { fixture } = await renderComponent(ImportResourceComponent, {
        declarations: [ImportResourceComponent],
        imports: sharedImports,
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [permissionProvider([SystemPermission.ImportResources])],
      });
      expect(fixture.componentInstance).toBeTruthy();
    });

    it('should render without ImportResources permission', async () => {
      const { fixture } = await renderComponent(ImportResourceComponent, {
        declarations: [ImportResourceComponent],
        imports: sharedImports,
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [permissionProvider([])],
      });
      expect(fixture.componentInstance).toBeTruthy();
    });
  });
});
