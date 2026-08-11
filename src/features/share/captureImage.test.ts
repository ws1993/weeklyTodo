import { describe, expect, it, vi } from 'vitest';

const { toPngMock } = vi.hoisted(() => ({
  toPngMock: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toPng: toPngMock,
}));

import { captureShareCard } from './captureImage';

describe('captureShareCard', () => {
  it('exports the card at twice the preview scale, keeping the same layout', async () => {
    const shareCardElement = {
      scrollHeight: 960,
      scrollWidth: 800,
    } as HTMLElement;
    toPngMock.mockResolvedValue('data:image/png;base64,share-card');

    await captureShareCard(shareCardElement);

    expect(toPngMock).toHaveBeenCalledWith(shareCardElement, {
      backgroundColor: '#FFFFFF',
      canvasHeight: 1114,
      canvasWidth: 928,
      cacheBust: false,
      height: 960,
      pixelRatio: 1,
      width: 800,
    });
  });

  it('temporarily neutralizes the preview zoom wrapper during capture', async () => {
    const zoomHost = { style: { zoom: '0.58' } };
    const shareCardElement = {
      scrollHeight: 960,
      scrollWidth: 800,
      parentElement: zoomHost,
    } as unknown as HTMLElement;
    toPngMock.mockImplementation(async () => {
      // html-to-image must capture an un-zoomed card, otherwise the ancestor
      // zoom pollutes the cloned styles and the output doubles in size.
      expect(zoomHost.style.zoom).toBe('1');
      return 'data:image/png;base64,share-card';
    });

    await captureShareCard(shareCardElement);

    expect(zoomHost.style.zoom).toBe('0.58');
  });
});
