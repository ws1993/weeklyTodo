import type { GroupColor } from '../shared/contracts/types';

/**
 * 分组色板：色相均匀分布、高区分度，避开品牌蓝（#1557D0）与语义色。
 * 必须与 `src-tauri/src/domain.rs` 的 `GROUP_COLOR_PALETTE` 保持一致——
 * 后端负责自动分配（取第一个未用色），前端仅用于展示与手动换色。
 */
export const GROUP_PALETTE: string[] = [
  '#E05A3E', '#E0A03D', '#A9B84A', '#4F9E5A', '#2E9E7C', '#2AA5A0',
  '#3B8FBF', '#4A6FD1', '#5A5FC0', '#7A5FC0', '#C05FA0', '#C0557A',
];

/** 尚未分配颜色时的中性占位色。 */
export const GROUP_COLOR_PENDING = '#8B95A7';

/** Build a name -> color map from the stored mappings. */
export function groupColorMap(colors: GroupColor[]): Map<string, string> {
  return new Map(colors.map((entry) => [entry.name, entry.color]));
}
