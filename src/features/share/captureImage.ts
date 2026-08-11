import { toPng } from 'html-to-image';
import { saveSharePng } from '../../api/nativeBridge';
import { scaleShareCardDimension } from './shareLayout';

const SHARE_PNG_PIXEL_RATIO = 2;

/**
 * 将分享卡片渲染为 2x 高清 PNG dataURL。
 *
 * 卡片始终先按完整尺寸排版，再以与预览一致的比例缩小最终 PNG 画布。
 */
export async function captureShareCard(node: HTMLElement): Promise<string> {
  const cardWidth = node.scrollWidth;
  const cardHeight = node.scrollHeight;
  return toPng(node, {
    pixelRatio: SHARE_PNG_PIXEL_RATIO,
    cacheBust: false,
    backgroundColor: '#FFFFFF',
    width: cardWidth,
    height: cardHeight,
    canvasWidth: scaleShareCardDimension(cardWidth),
    canvasHeight: scaleShareCardDimension(cardHeight),
  });
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
