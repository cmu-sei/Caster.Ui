/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import {
  Design,
  DesignsService,
  EditDesignCommand,
} from 'src/app/generated/caster-api';
import { DesignStore } from './design.store';

@Injectable({ providedIn: 'root' })
export class DesignService {
  constructor(
    private designStore: DesignStore,
    private designsService: DesignsService
  ) {}

  add(design: Design) {
    this.designStore.add(design);
  }

  update(id, design: Partial<Design>) {
    this.designStore.update(id, design);
  }

  remove(id: string) {
    this.designStore.remove(id);
  }

  setDesigns(designs: Design[]) {
    this.designStore.set(designs);
  }

  create(design: Design) {
    this.designsService.createDesign(design).subscribe();
  }

  edit(id: string, design: Partial<Design>) {
    this.designsService
      .editDesign(id, { ...design } as EditDesignCommand)
      .subscribe();
  }

  delete(id: string) {
    this.designsService.deleteDesign(id).subscribe();
  }

  toggleEnabled(design: Design) {
    if (design.enabled) {
      this.designsService.disableDesign(design.id).subscribe();
    } else {
      this.designsService.enableDesign(design.id).subscribe();
    }
  }
}
