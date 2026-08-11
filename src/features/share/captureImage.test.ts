import { describe, expect, it, vi } from 'vitest';

const { toPngMock } = vi.hoisted(() => ({
  toPngMock: vi.fn(),
}));

vi.mock('html-to-image', () => ({
  toPng: toPngMock,
}));

import { captureShareCard } from './captureImage';

describe('captureShareCard', () => {
  it('keeps the card layout width while exporting at the preview scale', async () => {
    const shareCardElement = {
      scrollHeight: 960,
      scrollWidth: 800,
    } as HTMLElement;
    toPngMock.mockResolvedValue('data:image/png;base64,share-card');

    await captureShareCard(shareCardElement);

    expect(toPngMock).toHaveBeenCalledWith(shareCardElement, {
      backgroundColor: '#FFFFFF',
      canvasHeight: 557,
      canvasWidth: 464,
      cacheBust: false,
      height: 960,
      pixelRatio: 2,
      width: 800,
    });
  });
});
