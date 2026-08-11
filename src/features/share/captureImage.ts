import { toPng } from 'html-to-image';
import { saveSharePng } from '../../api/nativeBridge';
import { scaleShareCardDimension } from './shareLayout';

/**
 * 将分享卡片渲染为与预览完全一致的 PNG dataURL。
 *
 * 预览通过 CSS `zoom: 0.58` 缩放显示卡片。若直接截取该 DOM，html-to-image
 * 会把祖先 zoom 写进克隆样式，且 canvas 尺寸会被 pixelRatio 二次放大，
 * 导致成品比预览大 2 倍（组件变大、相互压盖）。因此导出前先把 zoom 容器
 * 临时还原为自然尺寸，再按预览比例输出画布，保证所见即所得。
 *
 * 在预览比例基础上再放大 SHARE_PNG_EXPORT_UPSCALE 倍输出：布局与预览完全
 * 一致，但图片更大（卡片 800px 宽 → 预览 464px → 导出约 928px）。
 */
const SHARE_PNG_EXPORT_UPSCALE = 2;

export async function captureShareCard(node: HTMLElement): Promise<string> {
  const zoomHost = node.parentElement;
  const previousZoom = zoomHost?.style.zoom ?? '';
  if (zoomHost) {
    zoomHost.style.zoom = '1';
  }
  try {
    const cardWidth = node.scrollWidth;
    const cardHeight = node.scrollHeight;
    return await toPng(node, {
      // pixelRatio 固定为 1：canvasWidth/canvasHeight 已按预览比例和导出放大倍数
      // 计算好，库内部会把 canvas 尺寸再乘 pixelRatio 并把 SVG 拉伸填满画布。
      pixelRatio: 1,
      cacheBust: false,
      backgroundColor: '#FFFFFF',
      width: cardWidth,
      height: cardHeight,
      canvasWidth: scaleShareCardDimension(cardWidth) * SHARE_PNG_EXPORT_UPSCALE,
      canvasHeight: scaleShareCardDimension(cardHeight) * SHARE_PNG_EXPORT_UPSCALE,
    });
  } finally {
    if (zoomHost) {
      zoomHost.style.zoom = previousZoom;
    }
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(',');
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * 把分享图复制到系统剪贴板。
 * 支持时用 ClipboardItem（PNG 位图可直接粘贴到微信/邮件/文档）；
 * 不支持时抛出错误，调用方降级提示「请另存为 PNG」。
 */
export async function copyShareCardToClipboard(dataUrl: string): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
  const clipboardItem = new ClipboardItem({ [blob.type]: blob });
  await navigator.clipboard.write([clipboardItem]);
}

/**
 * 通过 Rust 命令弹系统保存对话框，把分享图写入 PNG 文件。
 * 返回保存路径；用户取消时返回 null。
 */
export async function saveShareCardToFile(dataUrl: string, suggestedName: string): Promise<string | null> {
  return saveSharePng(dataUrl, suggestedName);
}
