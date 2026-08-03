import { readFile, writeFile } from 'node:fs/promises';

const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

const body = `
<div class="query-overlay">
  <header class="query-overlay-header">
    <div class="query-overlay-title">
      <span class="query-overlay-glyph">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.7"/>
          <path d="M3.5 9.5h17M8 2.8v3.6M16 2.8v3.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
      </span>
      查看所有周
    </div>
    <div class="query-overlay-actions">
      <span class="query-overlay-hint">点击结果跳转到对应周</span>
      <button class="query-overlay-close" title="关闭">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </header>

  <div class="query-shell">
    <aside class="query-sidebar">
      <div class="query-sidebar-head">
        <span class="query-sidebar-title">全部周</span>
        <span class="query-sidebar-count">38 周</span>
      </div>
      <div class="query-week-list">
        <button type="button" class="query-week-item all selected">
          <span class="query-week-top"><span class="query-week-id">全部</span></span>
          <span class="query-week-range">跨周检索所有任务分支</span>
        </button>

        <div class="query-year-group">
          <div class="query-year-head">2026</div>
          <button type="button" class="query-week-item">
            <span class="query-week-top">
              <span class="query-week-id">20260803-20260809</span>
              <span class="badge-now">本周</span>
              <span class="chip active">进行中</span>
            </span>
            <span class="query-week-range">8月3日 – 8月9日</span>
            <span class="query-week-meta">
              <span class="query-week-progress"><span class="query-week-progress-bar" style="width:34%"/></span>
              <span class="query-week-count">7/21</span>
            </span>
          </button>
          <button type="button" class="query-week-item">
            <span class="query-week-top">
              <span class="query-week-id">20260727-20260802</span>
              <span class="chip past">已收尾</span>
            </span>
            <span class="query-week-range">7月27日 – 8月2日</span>
            <span class="query-week-meta">
              <span class="query-week-progress"><span class="query-week-progress-bar" style="width:82%"/></span>
              <span class="query-week-count">18/22</span>
            </span>
          </button>
          <button type="button" class="query-week-item">
            <span class="query-week-top">
              <span class="query-week-id">20260720-20260726</span>
              <span class="chip past">已收尾</span>
            </span>
            <span class="query-week-range">7月20日 – 7月26日</span>
            <span class="query-week-meta">
              <span class="query-week-progress"><span class="query-week-progress-bar" style="width:100%"/></span>
              <span class="query-week-count">15/15</span>
            </span>
          </button>
          <button type="button" class="query-week-item selected">
            <span class="query-week-top">
              <span class="query-week-id">20260713-20260719</span>
              <span class="chip past">已收尾</span>
            </span>
            <span class="query-week-range">7月13日 – 7月19日</span>
            <span class="query-week-meta">
              <span class="query-week-progress"><span class="query-week-progress-bar" style="width:60%"/></span>
              <span class="query-week-count">9/15</span>
            </span>
          </button>
          <button type="button" class="query-week-item">
            <span class="query-week-top">
              <span class="query-week-id">20260706-20260712</span>
              <span class="chip past">已收尾</span>
            </span>
            <span class="query-week-range">7月6日 – 7月12日</span>
            <span class="query-week-empty">暂无任务</span>
          </button>
        </div>

        <div class="query-year-group">
          <div class="query-year-head">2025</div>
          <button type="button" class="query-week-item">
            <span class="query-week-top">
              <span class="query-week-id">20251229-20260104</span>
              <span class="chip past">已收尾</span>
            </span>
            <span class="query-week-range">12月29日 – 1月4日</span>
            <span class="query-week-meta">
              <span class="query-week-progress"><span class="query-week-progress-bar" style="width:91%"/></span>
              <span class="query-week-count">10/11</span>
            </span>
          </button>
        </div>
      </div>
    </aside>

    <main class="query-content">
      <div class="query-toolbar">
        <div class="query-toolbar-row">
          <div class="search-field">
            <span class="search-field-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.6" cy="10.6" r="6.2" stroke="currentColor" stroke-width="1.8"/>
                <path d="M15.4 15.4l4.6 4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </span>
            <input type="text" class="search-field-input" placeholder="搜索任务名或路径…" value="版本">
            <button type="button" class="search-field-clear" title="清空关键词">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <button type="button" role="switch" aria-checked="true" class="toggle on">
            <span class="toggle-track"><span class="toggle-thumb"/></span>
            <span class="toggle-label">只看带入任务</span>
          </button>
        </div>
        <div class="query-toolbar-row">
          <div class="segmented-wrap">
            <span class="control-label">状态</span>
            <div class="segmented" role="radiogroup" aria-label="状态">
              <button type="button" role="radio" aria-checked="false" class="segmented-item">全部</button>
              <button type="button" role="radio" aria-checked="true" class="segmented-item active">未完成</button>
              <button type="button" role="radio" aria-checked="false" class="segmented-item">已完成</button>
            </div>
          </div>
          <span class="query-toolbar-sep"/>
          <div class="dropdown">
            <button type="button" class="dropdown-trigger" aria-haspopup="listbox" aria-expanded="false">
              <span class="dropdown-label">负责人</span>
              <span class="dropdown-value">全部负责人</span>
              <span class="dropdown-chevron">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>
          </div>
          <div class="dropdown">
            <button type="button" class="dropdown-trigger active" aria-haspopup="listbox" aria-expanded="true">
              <span class="dropdown-label">标签</span>
              <span class="dropdown-value">发布</span>
              <span class="dropdown-chevron open">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>
            <div class="dropdown-menu" role="listbox" aria-label="标签">
              <button type="button" role="option" aria-selected="false" class="dropdown-option">
                <span class="dropdown-option-check"></span>
                <span class="dropdown-option-label">全部标签</span>
              </button>
              <button type="button" role="option" aria-selected="true" class="dropdown-option selected">
                <span class="dropdown-option-check">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3.4 8.6l3 3 6.2-7.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
                <span class="dropdown-option-label">发布</span>
              </button>
              <button type="button" role="option" aria-selected="false" class="dropdown-option highlighted">
                <span class="dropdown-option-check"></span>
                <span class="dropdown-option-label">开发</span>
              </button>
              <button type="button" role="option" aria-selected="false" class="dropdown-option">
                <span class="dropdown-option-check"></span>
                <span class="dropdown-option-label">体验优化</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="query-results-head">
        <span>找到 <b>6</b> 条分支<span class="query-results-scope"> · 20260713-20260719</span></span>
        <span class="query-results-meta">38 个周 · 仅保存在本机</span>
      </div>

      <div class="query-results">
        <div class="query-row" role="button" tabindex="0">
          <span class="query-row-dot"></span>
          <span class="query-row-main">
            <span class="query-row-title">v0.4.0 发布：支持代理设置</span>
            <span class="query-row-path">版本发布 / 功能</span>
          </span>
          <span class="query-row-tags">
            <span class="tag tag-carry">带入</span>
            <span class="tag tag-priority p0">P0</span>
            <span class="tag tag-follow">跟进</span>
            <span class="tag tag-owner">小明</span>
            <span class="tag tag-label">发布</span>
          </span>
          <span class="query-row-week">20260713-20260719</span>
          <span class="query-row-go">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
        <div class="query-row" role="button" tabindex="0">
          <span class="query-row-dot"></span>
          <span class="query-row-main">
            <span class="query-row-title">调研桌面端发布流程，输出对比文档</span>
            <span class="query-row-path">版本发布 / 调研</span>
          </span>
          <span class="query-row-tags">
            <span class="tag tag-priority p1">P1</span>
            <span class="tag tag-self">自己</span>
            <span class="tag tag-label">开发</span>
          </span>
          <span class="query-row-week">20260713-20260719</span>
          <span class="query-row-go">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
        <div class="query-row" role="button" tabindex="0">
          <span class="query-row-dot closed"></span>
          <span class="query-row-main">
            <span class="query-row-title closed">v0.3.1 版本发布说明整理</span>
            <span class="query-row-path">版本发布 / 收尾</span>
          </span>
          <span class="query-row-tags">
            <span class="tag tag-priority p2">P2</span>
            <span class="tag tag-follow">跟进</span>
            <span class="tag tag-owner">小红</span>
            <span class="tag tag-label">发布</span>
          </span>
          <span class="query-row-week">20260706-20260712</span>
          <span class="query-row-go">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </div>
      </div>
    </main>
  </div>
</div>
`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>查看所有周 · 全屏设计预览</title>
  <style>
${styles}
  </style>
</head>
<body>
${body}
</body>
</html>
`;

await writeFile(new URL('./query-all-weeks-preview.html', import.meta.url), html, 'utf8');
console.log('preview written');
