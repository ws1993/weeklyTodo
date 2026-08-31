import { useState, useEffect } from 'react';
import { theme as antdTheme, type ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark' | 'forest';

const THEME_STORAGE_KEY = 'weeklytodo_theme';

export function getSavedTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (saved === 'dark' || saved === 'forest' || saved === 'light') {
    return saved;
  }
  return 'light';
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (mode === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }
  localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export function getAntdThemeConfig(mode: ThemeMode): ThemeConfig {
  const baseFont =
    '"Plus Jakarta Sans", "Segoe UI Variable", "Microsoft YaHei UI", -apple-system, "Segoe UI", "PingFang SC", sans-serif';

  if (mode === 'dark') {
    return {
      algorithm: antdTheme.darkAlgorithm,
      token: {
        colorPrimary: '#3B82F6',
        colorTextBase: '#F8FAFC',
        colorBgBase: '#141C2B',
        colorBgContainer: '#1A2438',
        colorBorder: '#243044',
        borderRadius: 6,
        fontFamily: baseFont,
      },
    };
  }

  if (mode === 'forest') {
    return {
      algorithm: antdTheme.darkAlgorithm,
      token: {
        colorPrimary: '#10B981',
        colorTextBase: '#F1F5F3',
        colorBgBase: '#172421',
        colorBgContainer: '#1E2E2A',
        colorBorder: '#253833',
        borderRadius: 6,
        fontFamily: baseFont,
      },
    };
  }

  // Light mode (default)
  return {
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#2563EB',
      colorTextBase: '#0F172A',
      colorBgBase: '#FFFFFF',
      colorBgContainer: '#FFFFFF',
      colorBorder: '#E2E8F0',
      borderRadius: 6,
      fontFamily: baseFont,
    },
  };
}

/** Hook for listening to and toggling theme across the application. */
export function useAppTheme(): {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  cycleTheme: () => void;
} {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getSavedTheme);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const setTheme = (mode: ThemeMode) => {
    setCurrentTheme(mode);
    applyTheme(mode);
  };

  const cycleTheme = () => {
    const sequence: ThemeMode[] = ['light', 'dark', 'forest'];
    const nextIndex = (sequence.indexOf(currentTheme) + 1) % sequence.length;
    const nextTheme = sequence[nextIndex];
    setTheme(nextTheme);
  };

  return {
    theme: currentTheme,
    setTheme,
    cycleTheme,
  };
}
