/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { Order, QueryConfig, QueryEntity } from '@datorama/akita';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ModuleQuery } from 'src/app/modules/state';
import { DesignModuleStore, DesignModuleState } from './design-module.store';

@QueryConfig({
  sortBy: 'name',
  sortByOrder: Order.ASC,
})
@Injectable({ providedIn: 'root' })
export class DesignModuleQuery extends QueryEntity<DesignModuleState> {
  constructor(
    protected store: DesignModuleStore,
    private moduleQuery: ModuleQuery
  ) {
    super(store);
  }

  getByDesignId(designId: string) {
    return this.selectAll({ filterBy: (x) => x.designId == designId });
  }

  getValues(designModuleId: string) {
    return this.selectEntity(designModuleId, (entity) => entity.values);
  }

  getOutputsByDesignId(
    designId: string,
    excludedDesignModuleId: string = null
  ) {
    return combineLatest([
      this.getByDesignId(designId),
      this.moduleQuery.selectAll(),
    ]).pipe(
      map(([designModules, modules]) => {
        const outputs = [];

        designModules
          .filter((designModule) => designModule.id != excludedDesignModuleId)
          .forEach((designModule) => {
            const module = modules?.find((x) => x.id == designModule.moduleId);

            if (module) {
              const version = module.versions?.find(
                (x) => x.name == designModule.moduleVersion
              );

              if (version) {
                version?.outputs.forEach((x) => {
                  const output = {
                    designModuleName: designModule.name,
                    name: x.name,
                    terraform: `$\{module.${designModule.name}.${x.name}}`,
                  };

                  outputs.push(output);
                });
              }
            }
          });

        return outputs;
      })
    );
  }
}
