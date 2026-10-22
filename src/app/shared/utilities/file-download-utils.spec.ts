// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  onTestFinished,
  type Mock,
} from 'vitest';
import { flush } from '../../test-utils/unhandled-rx-errors';
import FileDownloadUtils from './file-download-utils';

/**
 * jsdom has no URL.createObjectURL / revokeObjectURL, so install mocks for the
 * duration of one test and put the originals (if any) back afterwards.
 */
function mockObjectUrls() {
  const original = {
    create: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
    revoke: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
  };
  const createObjectURL = vi.fn(
    (_blob: Blob) => 'blob:https://caster.test/1234',
  );
  const revokeObjectURL = vi.fn((_url: string) => undefined);
  Object.defineProperty(URL, 'createObjectURL', {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    configurable: true,
    writable: true,
  });
  onTestFinished(() => {
    for (const [key, descriptor] of [
      ['createObjectURL', original.create],
      ['revokeObjectURL', original.revoke],
    ] as const) {
      if (descriptor) Object.defineProperty(URL, key, descriptor);
      else delete (URL as unknown as Record<string, unknown>)[key];
    }
  });
  return { createObjectURL, revokeObjectURL };
}

describe('FileDownloadUtils.downloadFile', () => {
  let click: Mock<() => void>;
  let clickedAnchors: HTMLAnchorElement[];

  beforeEach(() => {
    clickedAnchors = [];
    // jsdom would try to navigate to the blob URL ("Not implemented:
    // navigation"); record the anchor instead.
    click = vi.fn<() => void>();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedAnchors.push(this);
      click();
    });
  });

  /**
   * Verifies: the blob is turned into an object URL and a detached <a download> pointing at it is clicked once.
   * Interacts with: URL.createObjectURL (mocked), HTMLAnchorElement.prototype.click (spied).
   * Data: a text blob named 'main.tf'.
   */
  it('clicks a download link for an object URL of the blob', () => {
    const { createObjectURL } = mockObjectUrls();
    const blob = new Blob(['resource "x" "y" {}'], { type: 'text/plain' });

    FileDownloadUtils.downloadFile(blob, 'main.tf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    const [anchor] = clickedAnchors;
    expect(anchor.href).toBe('blob:https://caster.test/1234');
    expect(anchor.download).toBe('main.tf');
    expect(anchor.isConnected).toBe(false);
  });

  /**
   * Verifies: the object URL is never revoked, so each download keeps its blob alive until the page unloads.
   * Interacts with: URL.revokeObjectURL (mocked).
   * Data: two downloads.
   */
  it('never revokes the object URL', async () => {
    const { revokeObjectURL } = mockObjectUrls();

    FileDownloadUtils.downloadFile(new Blob(['a']), 'a.zip');
    FileDownloadUtils.downloadFile(new Blob(['b']), 'b.zip');
    await flush();

    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(2);
  });
});
