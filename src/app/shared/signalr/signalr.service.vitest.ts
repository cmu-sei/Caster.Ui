// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { getDefaultProviders } from 'src/app/test-utils/vitest-default-providers';
import { SignalRService } from './signalr.service';

describe('SignalRService', () => {
  it('should be created', () => {
    TestBed.configureTestingModule({
      providers: [...getDefaultProviders(), SignalRService],
    });
    const service = TestBed.inject(SignalRService);
    expect(service).toBeTruthy();
  });

  describe('connection lifecycle', () => {
    let service: SignalRService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [...getDefaultProviders(), SignalRService],
      });
      service = TestBed.inject(SignalRService);
    });

    it('should have startConnection method', () => {
      expect(typeof service.startConnection).toBe('function');
    });

    it('should have joinProject method', () => {
      expect(typeof service.joinProject).toBe('function');
    });

    it('should have leaveProject method', () => {
      expect(typeof service.leaveProject).toBe('function');
    });

    it('should have joinWorkspace method', () => {
      expect(typeof service.joinWorkspace).toBe('function');
    });

    it('should have leaveWorkspace method', () => {
      expect(typeof service.leaveWorkspace).toBe('function');
    });

    it('should have joinDesign method', () => {
      expect(typeof service.joinDesign).toBe('function');
    });

    it('should have leaveDesign method', () => {
      expect(typeof service.leaveDesign).toBe('function');
    });

    it('should have joinWorkspacesAdmin method', () => {
      expect(typeof service.joinWorkspacesAdmin).toBe('function');
    });

    it('should have leaveWorkspacesAdmin method', () => {
      expect(typeof service.leaveWorkspacesAdmin).toBe('function');
    });

    it('should have joinVlansAdmin method', () => {
      expect(typeof service.joinVlansAdmin).toBe('function');
    });

    it('should have leaveVlansAdmin method', () => {
      expect(typeof service.leaveVlansAdmin).toBe('function');
    });

    it('should have joinRolesAdmin method', () => {
      expect(typeof service.joinRolesAdmin).toBe('function');
    });

    it('should have leaveRolesAdmin method', () => {
      expect(typeof service.leaveRolesAdmin).toBe('function');
    });

    it('should have streamPlanOutput method', () => {
      expect(typeof service.streamPlanOutput).toBe('function');
    });

    it('should have streamApplyOutput method', () => {
      expect(typeof service.streamApplyOutput).toBe('function');
    });
  });

  describe('mock SignalRService from default providers', () => {
    it('startConnection should resolve', async () => {
      TestBed.configureTestingModule({
        providers: [...getDefaultProviders()],
      });
      const mockService = TestBed.inject(SignalRService);
      const result = await mockService.startConnection();
      expect(result).toBeUndefined();
    });

    it('joinProject should be callable', () => {
      TestBed.configureTestingModule({
        providers: [...getDefaultProviders()],
      });
      const mockService = TestBed.inject(SignalRService);
      expect(() => mockService.joinProject('test-project')).not.toThrow();
    });

    it('leaveProject should be callable', () => {
      TestBed.configureTestingModule({
        providers: [...getDefaultProviders()],
      });
      const mockService = TestBed.inject(SignalRService);
      expect(() => mockService.leaveProject('test-project')).not.toThrow();
    });

    it('joinWorkspace should be callable', () => {
      TestBed.configureTestingModule({
        providers: [...getDefaultProviders()],
      });
      const mockService = TestBed.inject(SignalRService);
      expect(() => mockService.joinWorkspace('test-workspace')).not.toThrow();
    });

    it('leaveWorkspace should be callable', () => {
      TestBed.configureTestingModule({
        providers: [...getDefaultProviders()],
      });
      const mockService = TestBed.inject(SignalRService);
      expect(() =>
        mockService.leaveWorkspace('test-workspace')
      ).not.toThrow();
    });
  });
});
