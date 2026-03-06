// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PortalModule } from '@angular/cdk/portal';
import { CwdToolbarNavigationItemComponent } from './cwd-toolbar-navigation-item.component';

describe('CwdToolbarNavigationItemComponent', () => {
  it('should create', async () => {
    // The component tries to attach to #toolbar-navigation, so we create the target element
    const target = document.createElement('div');
    target.id = 'toolbar-navigation';
    document.body.appendChild(target);

    try {
      await TestBed.configureTestingModule({
        declarations: [CwdToolbarNavigationItemComponent],
        imports: [NoopAnimationsModule, PortalModule],
      }).compileComponents();

      const fixture = TestBed.createComponent(CwdToolbarNavigationItemComponent);
      fixture.detectChanges();
      expect(fixture.componentInstance).toBeTruthy();
    } finally {
      document.body.removeChild(target);
    }
  });
});
