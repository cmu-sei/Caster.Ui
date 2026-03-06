// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, ElementRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ComnSettingsService } from '@cmusei/crucible-common';
import { HotkeysService } from '@ngneat/hotkeys';
import { CrucibleHotkeyDirective } from './crucible-hotkey.directive';

describe('CrucibleHotkeyDirective', () => {
  it('should create an instance', () => {
    const mockSettings = { settings: { Hotkeys: {} } } as any;
    const mockHotkeys = { onShortcut: () => {} } as any;
    const mockEl = new ElementRef(document.createElement('div'));
    const directive = new CrucibleHotkeyDirective(
      mockSettings,
      mockHotkeys,
      mockEl
    );
    expect(directive).toBeTruthy();
  });

  it('should have hotkeyAction input', () => {
    const mockSettings = { settings: { Hotkeys: {} } } as any;
    const mockHotkeys = { onShortcut: () => {} } as any;
    const mockEl = new ElementRef(document.createElement('div'));
    const directive = new CrucibleHotkeyDirective(
      mockSettings,
      mockHotkeys,
      mockEl
    );
    directive.hotkeyAction = 'save';
    expect(directive.hotkeyAction).toBe('save');
  });

  it('should register keyboard shortcut on ngAfterViewInit', () => {
    const onShortcutSpy = vi.fn();
    const mockSettings = {
      settings: {
        Hotkeys: {
          save: { keys: 'ctrl+s' },
        },
      },
    } as any;
    const mockHotkeys = { onShortcut: onShortcutSpy } as any;
    const mockEl = new ElementRef(document.createElement('div'));
    const directive = new CrucibleHotkeyDirective(
      mockSettings,
      mockHotkeys,
      mockEl
    );
    directive.hotkeyAction = 'save';
    directive.ngAfterViewInit();

    expect(onShortcutSpy).toHaveBeenCalledOnce();
    expect(typeof onShortcutSpy.mock.calls[0][0]).toBe('function');
  });

  it('should emit hotkeyFn when matching action is triggered', () => {
    let registeredCallback: Function | null = null;
    const mockSettings = {
      settings: {
        Hotkeys: {
          save: { keys: 'ctrl+s' },
        },
      },
    } as any;
    const mockHotkeys = {
      onShortcut: (cb: Function) => {
        registeredCallback = cb;
      },
    } as any;
    const mockEl = new ElementRef(document.createElement('div'));
    const directive = new CrucibleHotkeyDirective(
      mockSettings,
      mockHotkeys,
      mockEl
    );
    directive.hotkeyAction = 'save';

    const emitSpy = vi.fn();
    directive.hotkeyFn.subscribe(emitSpy);

    directive.ngAfterViewInit();

    // Simulate shortcut matching save action
    expect(registeredCallback).toBeTruthy();
    registeredCallback!(new KeyboardEvent('keydown'), 'ctrl+s', null);

    expect(emitSpy).toHaveBeenCalledOnce();
  });

  it('should click element when no hotkeyFn observers and action matches', () => {
    let registeredCallback: Function | null = null;
    const mockSettings = {
      settings: {
        Hotkeys: {
          open: { keys: 'ctrl+o' },
        },
      },
    } as any;
    const mockHotkeys = {
      onShortcut: (cb: Function) => {
        registeredCallback = cb;
      },
    } as any;
    const mockElement = document.createElement('button');
    const clickSpy = vi.spyOn(mockElement, 'click');
    const mockEl = new ElementRef(mockElement);
    const directive = new CrucibleHotkeyDirective(
      mockSettings,
      mockHotkeys,
      mockEl
    );
    directive.hotkeyAction = 'open';

    // Don't subscribe to hotkeyFn so there are no observers
    directive.ngAfterViewInit();

    expect(registeredCallback).toBeTruthy();
    registeredCallback!(new KeyboardEvent('keydown'), 'ctrl+o', null);

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('should not emit or click when action does not match', () => {
    let registeredCallback: Function | null = null;
    const mockSettings = {
      settings: {
        Hotkeys: {
          save: { keys: 'ctrl+s' },
        },
      },
    } as any;
    const mockHotkeys = {
      onShortcut: (cb: Function) => {
        registeredCallback = cb;
      },
    } as any;
    const mockElement = document.createElement('button');
    const clickSpy = vi.spyOn(mockElement, 'click');
    const mockEl = new ElementRef(mockElement);
    const directive = new CrucibleHotkeyDirective(
      mockSettings,
      mockHotkeys,
      mockEl
    );
    directive.hotkeyAction = 'open'; // Different from what's in hotkeys

    const emitSpy = vi.fn();
    directive.hotkeyFn.subscribe(emitSpy);

    directive.ngAfterViewInit();

    // Simulate shortcut for ctrl+s (matches 'save' not 'open')
    registeredCallback!(new KeyboardEvent('keydown'), 'ctrl+s', null);

    expect(emitSpy).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  describe('test host component', () => {
    @Component({
      template: `<button hotkeyAction="save" (hotkeyFn)="onHotkey($event)">
        Save
      </button>`,
      standalone: false,
    })
    class TestHostComponent {
      onHotkey = vi.fn();
    }

    it('should compile directive with a test host component', async () => {
      const onShortcutSpy = vi.fn();

      TestBed.configureTestingModule({
        declarations: [CrucibleHotkeyDirective, TestHostComponent],
        providers: [
          {
            provide: ComnSettingsService,
            useValue: {
              settings: {
                Hotkeys: { save: { keys: 'ctrl+s' } },
              },
            },
          },
          {
            provide: HotkeysService,
            useValue: { onShortcut: onShortcutSpy },
          },
        ],
      });

      const fixture: ComponentFixture<TestHostComponent> =
        TestBed.createComponent(TestHostComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance).toBeTruthy();
      // After view init, the directive should register with HotkeysService
      expect(onShortcutSpy).toHaveBeenCalled();
    });
  });
});
