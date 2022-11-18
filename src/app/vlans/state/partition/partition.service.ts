/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import {
  EditPartitionCommand,
  PartialEditPartitionCommand,
  Partition,
  VlansService,
} from 'src/app/generated/caster-api';
import { PartitionStore } from './partition.store';

@Injectable({ providedIn: 'root' })
export class PartitionService {
  constructor(
    private partitionStore: PartitionStore,
    private vlansService: VlansService
  ) {}

  load() {
    this.partitionStore.setLoading(true);
    return this.vlansService.getPartitions().pipe(
      tap((partitions: Partition[]) => {
        this.partitionStore.set(partitions);
        this.partitionStore.setLoading(false);
      })
    );
  }

  loadByPoolId(id: string) {
    this.partitionStore.setLoading(true);
    return this.vlansService.getPartitionsByPool(id).pipe(
      tap((partitions: Partition[]) => {
        this.partitionStore.set(partitions);
        this.partitionStore.setLoading(false);
      })
    );
  }

  create(poolId: string) {
    return this.vlansService
      .createPartition(poolId, { name: 'New Partition' })
      .pipe(
        tap((partition: Partition) => {
          this.add(partition);
        })
      );
  }

  delete(id: string) {
    return this.vlansService.deletePartition(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  edit(id: string, command: EditPartitionCommand) {
    return this.vlansService.editPartition(id, command).pipe(
      tap((partition: Partition) => {
        this.update(id, partition);
      })
    );
  }

  partialEdit(id: string, command: PartialEditPartitionCommand) {
    return this.vlansService.partialEditPartition(id, command).pipe(
      tap((partition: Partition) => {
        this.update(id, partition);
      })
    );
  }

  unsetDefault(id: string) {
    return this.vlansService
      .unsetDefaultPartition()
      .pipe(tap(() => this.update(id, { isDefault: false })));
  }

  setDefault(id: string) {
    return this.vlansService
      .setDefaultPartition(id)
      .pipe(tap(() => this.update(id, { isDefault: true })));
  }

  add(partition: Partition) {
    this.partitionStore.upsert(partition.id, partition);
  }

  update(id, partition: Partial<Partition>) {
    this.partitionStore.update(id, partition);
  }

  remove(id: string) {
    this.partitionStore.remove(id);
  }
}
