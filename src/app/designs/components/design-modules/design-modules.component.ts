/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
} from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DesignModule } from 'src/app/generated/caster-api';
import { ModuleQuery, ModuleService } from 'src/app/modules/state';
import { DesignModuleQuery } from '../../state/design-modules/design-module.query';
import { DesignModuleService } from '../../state/design-modules/design-module.service';

@Component({
  selector: 'cas-design-modules',
  templateUrl: './design-modules.component.html',
  styleUrls: ['./design-modules.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignModulesComponent implements OnInit {
  @Input()
  designId: string;

  // #region showModuleListSubject
  private showModuleListSubject = new BehaviorSubject(false);
  public showModuleList$ = this.showModuleListSubject.asObservable();

  public set showModuleList(val: boolean) {
    this.showModuleListSubject.next(val);
  }

  public get showModuleList() {
    return this.showModuleListSubject.getValue();
  }
  // #endregion

  public modules$ = this.moduleQuery.selectAll();
  public designModules$: Observable<DesignModule[]>;

  constructor(
    private moduleService: ModuleService,
    public moduleQuery: ModuleQuery,
    private designModulesService: DesignModuleService,
    private designModuleQuery: DesignModuleQuery
  ) {}

  ngOnInit(): void {
    this.moduleService.load(false).subscribe();
    this.moduleService.loadByDesignId(this.designId, true).subscribe();

    this.designModules$ = this.designModuleQuery.getByDesignId(this.designId);
    this.designModulesService.loadByDesignId(this.designId).subscribe();
  }

  trackByFn(index, item) {
    return item.id;
  }

  getModuleFn(moduleId: string) {
    this.designModulesService
      .create({
        designId: this.designId,
        moduleId: moduleId,
        name: 'New Module',
        values: [],
      })
      .subscribe(() => {
        this.showModuleList = false;
      });
  }
}
