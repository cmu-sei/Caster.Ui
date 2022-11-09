import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  EditPoolCommand,
  PartialEditPoolCommand,
  Pool,
  VlansService,
} from 'src/app/generated/caster-api';
import { PoolStore } from './pool.store';

@Injectable({ providedIn: 'root' })
export class PoolService {
  constructor(
    private poolStore: PoolStore,
    private vlansService: VlansService
  ) {}

  load(): Observable<Pool[]> {
    this.poolStore.setLoading(true);
    return this.vlansService.getPools().pipe(
      tap((pools: Pool[]) => {
        this.poolStore.set(pools);
        this.poolStore.setLoading(false);
      })
    );
  }

  create() {
    return this.vlansService.createPool({ name: 'New Pool' }).pipe(
      tap((pool: Pool) => {
        this.add(pool);
      })
    );
  }

  edit(id: string, command: EditPoolCommand) {
    return this.vlansService.editPool(id, command).pipe(
      tap((pool: Pool) => {
        this.update(id, pool);
      })
    );
  }

  partialEdit(id: string, command: PartialEditPoolCommand) {
    return this.vlansService.partialEditPool(id, command).pipe(
      tap((pool: Pool) => {
        this.update(id, pool);
      })
    );
  }

  delete(id: string, force: boolean) {
    return this.vlansService.deletePool(id, { force: force }).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  add(pool: Pool) {
    this.poolStore.add(pool);
  }

  update(id, pool: Partial<Pool>) {
    this.poolStore.update(id, pool);
  }

  remove(id: string) {
    this.poolStore.remove(id);
  }
}
