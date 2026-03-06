// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { renderComponent } from 'src/app/test-utils/render-component';

function dialogProviders(
  data: any = {},
  closeFn: (...args: any[]) => void = () => {}
) {
  return [
    { provide: MAT_DIALOG_DATA, useValue: data },
    {
      provide: MatDialogRef,
      useValue: { close: closeFn, disableClose: false },
    },
  ];
}

async function renderDialog(
  overrides: {
    data?: any;
    closeFn?: (...args: any[]) => void;
    title?: string;
    message?: string;
  } = {}
) {
  const closeFn = overrides.closeFn ?? vi.fn();
  const result = await renderComponent(ConfirmDialogComponent, {
    declarations: [ConfirmDialogComponent],
    imports: [MatDialogModule, MatButtonModule],
    providers: dialogProviders(overrides.data ?? {}, closeFn),
    componentProperties: {
      ...(overrides.title != null ? { title: overrides.title } : {}),
      ...(overrides.message != null ? { message: overrides.message } : {}),
    } as any,
  });
  return { ...result, closeFn };
}

describe('ConfirmDialogComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderDialog();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display title and message', async () => {
    await renderDialog({
      title: 'Delete Item?',
      message: 'Are you sure you want to delete this item?',
    });

    expect(screen.getByText('Delete Item?')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this item?')
    ).toBeInTheDocument();
  });

  it('should show YES and NO buttons', async () => {
    await renderDialog();

    expect(screen.getByText('YES')).toBeInTheDocument();
    expect(screen.getByText('NO')).toBeInTheDocument();
  });

  it('should close with confirm=true on YES click', async () => {
    const closeFn = vi.fn();
    await renderDialog({
      closeFn,
      title: 'Confirm?',
      message: 'Please confirm.',
    });

    await userEvent.click(screen.getByText('YES'));

    expect(closeFn).toHaveBeenCalledOnce();
    expect(closeFn).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: true })
    );
  });

  it('should close with confirm=false on NO click', async () => {
    const closeFn = vi.fn();
    await renderDialog({
      closeFn,
      title: 'Confirm?',
      message: 'Please confirm.',
    });

    await userEvent.click(screen.getByText('NO'));

    expect(closeFn).toHaveBeenCalledOnce();
    expect(closeFn).toHaveBeenCalledWith(
      expect.objectContaining({ confirm: false })
    );
  });

  it('should pass removeArtifacts=false when no artifacts in data', async () => {
    const closeFn = vi.fn();
    await renderDialog({
      closeFn,
      data: {},
      title: 'Delete?',
      message: 'Confirm delete.',
    });

    await userEvent.click(screen.getByText('YES'));

    expect(closeFn).toHaveBeenCalledWith(
      expect.objectContaining({ removeArtifacts: false, confirm: true })
    );
  });

  it('should pass removeArtifacts=true when artifacts exist and YES clicked', async () => {
    const closeFn = vi.fn();
    await renderDialog({
      closeFn,
      data: { artifacts: ['artifact1', 'artifact2'] },
      title: 'Delete?',
      message: 'Confirm delete.',
    });

    await userEvent.click(screen.getByText('YES'));

    expect(closeFn).toHaveBeenCalledWith(
      expect.objectContaining({ removeArtifacts: true, confirm: true })
    );
  });

  it('should pass custom data properties through on close', async () => {
    const closeFn = vi.fn();
    await renderDialog({
      closeFn,
      data: { buttonTrueText: 'Delete', extra: 'value' },
      title: 'Delete?',
      message: 'Sure?',
    });

    await userEvent.click(screen.getByText('NO'));

    expect(closeFn).toHaveBeenCalledWith(
      expect.objectContaining({
        confirm: false,
        buttonTrueText: 'Delete',
        extra: 'value',
      })
    );
  });
});
