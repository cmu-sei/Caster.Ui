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
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {
  DomPortalOutlet,
  PortalOutlet,
  TemplatePortal,
} from '@angular/cdk/portal';

@Component({
  selector: 'cas-cwd-toolbar-navigation-item',
  templateUrl: './cwd-toolbar-navigation-item.component.html',
  styleUrls: ['./cwd-toolbar-navigation-item.component.scss'],
})
export class CwdToolbarNavigationItemComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private portalOutlet: PortalOutlet;
  private portal: TemplatePortal;
  @ViewChild('cwdToolbarNavigation', { static: true }) cwdNavigationTmplRef;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private injector: Injector,
    private appRef: ApplicationRef,
    private viewContainerRef: ViewContainerRef
  ) {}

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.portalOutlet = new DomPortalOutlet(
      document.querySelector('#toolbar-navigation'),
      this.componentFactoryResolver,
      this.appRef,
      this.injector
    );

    this.portal = new TemplatePortal(
      this.cwdNavigationTmplRef,
      this.viewContainerRef
    );
    this.portalOutlet.attach(this.portal);
  }

  ngOnDestroy(): void {
    this.portalOutlet.detach();
  }
}
