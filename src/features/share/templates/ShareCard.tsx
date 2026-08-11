import type { ShareData } from '../shareData';
import type { ShareSettings } from '../shareSettings';
import { TemplateRainbowTrack } from './TemplateRainbowTrack';

interface ShareCardProps {
  data: ShareData;
  settings: ShareSettings;
}

/**
 * 分享图渲染容器：按设置中的模板 id 分发到具体模板组件。
 * 容器本身是导出截图的目标 DOM 节点（宽度 800px，高度自适应）。
 */
export function ShareCard({ data, settings }: ShareCardProps) {
  switch (settings.templateId) {
    case 'rainbow-track':
      return <TemplateRainbowTrack data={data} settings={settings} />;
    default:
      return <TemplateRainbowTrack data={data} settings={settings} />;
  }
}
