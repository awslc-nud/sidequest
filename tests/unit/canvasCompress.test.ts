import { describe, expect, it } from 'vitest';
import {
  planQuality,
  resizeDimensions,
  MAX_CANVAS_EDGE,
  MAX_BYTES,
  MIN_QUALITY,
} from '../../src/client/canvasCompress';

describe('canvasCompress planning (AC-02 / §4.1)', () => {
  it('scales a 4000x3000 source to <=1920px long edge', () => {
    const { width, height } = resizeDimensions(4000, 3000);
    expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_CANVAS_EDGE);
    expect(width).toBe(1920);
    expect(height).toBe(1440);
  });

  it('never upscales small sources', () => {
    expect(resizeDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(resizeDimensions(2000, 1000)).toEqual({ width: 1920, height: 960 });
  });

  it('steps quality down until under the byte ceiling', async () => {
    const plan = await planQuality(async (q) => q > 0.6, 0.85);
    expect(plan.quality).toBe(0.6);
  });

  it('returns null when even floor quality stays oversized', async () => {
    const plan = await planQuality(async () => true);
    expect(plan.quality).toBeNull();
    expect(plan.quality === null).toBe(true);
  });

  it('returns the starting quality when already small enough', async () => {
    const plan = await planQuality(async () => false, 0.85);
    expect(plan.quality).toBe(0.85);
  });

  it('exposes the spec constants', () => {
    expect(MAX_BYTES).toBe(2_000_000);
    expect(MIN_QUALITY).toBe(0.5);
  });
});
