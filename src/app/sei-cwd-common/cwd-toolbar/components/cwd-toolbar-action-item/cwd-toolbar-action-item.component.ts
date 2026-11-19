// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ComponentFactoryResolver,
  Injector,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  DomPortalOutlet,
  PortalOutlet,
  TemplatePortal,
} from '@angular/cdk/portal';

@Component({
  selector: 'cas-cwd-toolbar-action-item',
  templateUrl: './cwd-toolbar-action-item.component.html',
  styleUrls: ['./cwd-toolbar-action-item.component.scss'],
})
export class CwdToolbarActionItemComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private componentFactoryResolver = inject(ComponentFactoryResolver);
  private injector = inject(Injector);
  private appRef = inject(ApplicationRef);
  private viewContainerRef = inject(ViewContainerRef);

  private portalOutlet: PortalOutlet;
  private portal: TemplatePortal;
  readonly selector = input<string>(undefined);
  readonly cwdActionTmplRef =
    viewChild<TemplateRef<unknown>>('cwdToolbarAction');

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.portalOutlet = new DomPortalOutlet(
      document.querySelector(this.selector()),
      this.appRef,
      this.injector,
    );

    this.portal = new TemplatePortal(
      this.cwdActionTmplRef(),
      this.viewContainerRef,
    );
    this.portalOutlet.attach(this.portal);
  }

  ngOnDestroy(): void {
    this.portalOutlet.detach();
  }
}
