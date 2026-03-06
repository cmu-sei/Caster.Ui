// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PortalModule } from '@angular/cdk/portal';
import { CwdToolbarActionItemComponent } from './cwd-toolbar-action-item.component';

describe('CwdToolbarActionItemComponent', () => {
  it('should create', async () => {
    // The component tries to attach to a DOM selector, so we create a target element
    const target = document.createElement('div');
    target.id = 'toolbar-action';
    document.body.appendChild(target);

    try {
      await TestBed.configureTestingModule({
        declarations: [CwdToolbarActionItemComponent],
        imports: [NoopAnimationsModule, PortalModule],
      }).compileComponents();

      const fixture = TestBed.createComponent(CwdToolbarActionItemComponent);
      fixture.componentInstance.selector = '#toolbar-action';
      fixture.detectChanges();
      expect(fixture.componentInstance).toBeTruthy();
    } finally {
      document.body.removeChild(target);
    }
  });
});
