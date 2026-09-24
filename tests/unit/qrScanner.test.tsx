// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import QrScanner, { cameraErrorMessage } from '../../src/components/react/QrScanner';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeStream() {
  const stop = vi.fn();
  return { stream: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop };
}

describe('QrScanner', () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    if (container) container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('maps getUserMedia failures to marshal-readable copy', () => {
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toMatch(/permission/i);
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/no camera/i);
    expect(cameraErrorMessage({})).toMatch(/use the code entry/i);
  });

  it('starts the rear camera on tap and stops the track on unmount', async () => {
    const { stream, stop } = fakeStream();
    const getUserMedia = vi.fn(async () => stream);
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });

    container = document.createElement('div');
    document.body.appendChild(container);
    const mounted = createRoot(container);
    root = mounted;

    await act(async () => {
      mounted.render(<QrScanner paused={false} onScan={() => undefined} />);
    });
    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Start camera');

    await act(async () => {
      button?.click();
      await sleep(20);
    });

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: 'environment' } }), audio: false }),
    );
    expect(container.querySelector('button')?.textContent).toContain('Stop');

    act(() => mounted.unmount());
    expect(stop).toHaveBeenCalled();
  });
});
