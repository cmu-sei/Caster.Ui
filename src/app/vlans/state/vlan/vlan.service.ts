/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  PartialEditVlanCommand,
  Vlan,
  VlansService,
} from 'src/app/generated/caster-api';
import { VlanStore } from './vlan.store';

@Injectable({ providedIn: 'root' })
export class VlanService {
  constructor(
    private vlanStore: VlanStore,
    private vlansService: VlansService
  ) {}

  loadByPoolId(id: string) {
    this.vlanStore.setLoading(true);
    return this.vlansService.getVlansByPool(id).pipe(
      tap((vlans: Vlan[]) => {
        this.vlanStore.set(vlans);
        this.vlanStore.setLoading(false);
      })
    );
  }

  partialEdit(id: string, command: PartialEditVlanCommand) {
    return this.vlansService.partialEditVlan(id, command).pipe(
      tap((vlan: Vlan) => {
        this.update(id, vlan);
      })
    );
  }

  addToPartition(partitionId: string, vlans: number) {
    return this.vlansService
      .addVlansToPartition(partitionId, { vlans: vlans })
      .pipe(
        tap((vlans: Vlan[]) => {
          this.vlanStore.upsertMany(vlans);
        })
      );
  }

  removeFromPartition(partitionId: string, vlans: number) {
    return this.vlansService
      .removeVlansFromPartition(partitionId, { vlans: vlans })
      .pipe(
        tap((vlans: Vlan[]) => {
          this.vlanStore.upsertMany(vlans);
        })
      );
  }

  acquire(vlan: Vlan) {
    return this.vlansService
      .acquireVlan({ partitionId: vlan.partitionId, vlanId: vlan.vlanId })
      .pipe(
        tap((vlan: Vlan) => {
          this.update(vlan.id, vlan);
        })
      );
  }

  release(vlan: Vlan) {
    return this.vlansService.releaseVlan(vlan.id).pipe(
      tap((vlan: Vlan) => {
        this.update(vlan.id, vlan);
      })
    );
  }

  reserve(vlan: Vlan) {
    return this.vlansService.partialEditVlan(vlan.id, { reserved: true }).pipe(
      tap((vlan: Vlan) => {
        this.update(vlan.id, vlan);
      })
    );
  }

  unreserve(vlan: Vlan) {
    return this.vlansService.partialEditVlan(vlan.id, { reserved: false }).pipe(
      tap((vlan: Vlan) => {
        this.update(vlan.id, vlan);
      })
    );
  }

  bulkReserve(reserved: boolean, vlanIds: string[]) {
    return this.vlansService.reserveVlans({
      reserved: reserved,
      vlanIds: vlanIds,
    });
  }

  reassign(vlanIds: string[], fromPartitionId: string, toPartitionId: string) {
    let obs: Observable<Vlan[]>;

    if (fromPartitionId == null) {
      obs = this.vlansService.addVlansToPartition(toPartitionId, {
        vlanIds: vlanIds,
      });
    } else if (toPartitionId == null) {
      obs = this.vlansService.removeVlansFromPartition(fromPartitionId, {
        vlanIds: vlanIds,
      });
    } else {
      obs = this.vlansService.reassignVlans({
        fromPartitionId: fromPartitionId,
        toPartitionId: toPartitionId,
        vlanIds: vlanIds,
      });
    }

    return obs.pipe(
      tap((vlans: Vlan[]) => {
        this.vlanStore.upsertMany(vlans);
      })
    );
  }

  add(vlan: Vlan) {
    this.vlanStore.add(vlan);
  }

  update(id, vlan: Partial<Vlan>) {
    this.vlanStore.update(id, vlan);
  }

  remove(id: string) {
    this.vlanStore.remove(id);
  }
}
