// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from 'vitest';
import { applyTheme, getAntdThemeConfig, getSavedTheme } from './theme';

describe('theme utility', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light theme when nothing saved in localStorage', () => {
    expect(getSavedTheme()).toBe('light');
  });

  it('applies dark and forest themes correctly to document element and localStorage', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('weeklytodo_theme')).toBe('dark');

    applyTheme('forest');
    expect(document.documentElement.getAttribute('data-theme')).toBe('forest');
    expect(localStorage.getItem('weeklytodo_theme')).toBe('forest');

    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(localStorage.getItem('weeklytodo_theme')).toBe('light');
  });

  it('generates proper AntD theme configs for light, dark, and forest modes', () => {
    const lightConfig = getAntdThemeConfig('light');
    expect(lightConfig.token?.colorPrimary).toBe('#2563EB');

    const darkConfig = getAntdThemeConfig('dark');
    expect(darkConfig.token?.colorPrimary).toBe('#3B82F6');

    const forestConfig = getAntdThemeConfig('forest');
    expect(forestConfig.token?.colorPrimary).toBe('#10B981');
  });
});
