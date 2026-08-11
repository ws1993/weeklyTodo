// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  createDefaultWebDavSettings,
  isSyncDue,
  isValidIntervalHours,
  isValidWebDavUrl,
  loadWebDavSettings,
  saveWebDavSettings,
} from './webdavSettings';

describe('webdavSettings', () => {
  it('provides a disabled-by-default configuration', () => {
    const settings = createDefaultWebDavSettings();
    expect(settings).toEqual({
      url: '',
      username: '',
      syncOnStartup: false,
      syncIntervalHours: 0,
      autoSyncPausedAfterRestore: false,
      backupRetention: 20,
    });
  });

  it('round-trips through localStorage', () => {
    saveWebDavSettings({
      ...createDefaultWebDavSettings(),
      url: 'https://dav.example.com/weeklytodo',
      username: 'alice',
      syncOnStartup: true,
      syncIntervalHours: 4,
      lastSyncedAt: '2026-08-04T08:00:00Z',
    });
    expect(loadWebDavSettings()).toMatchObject({
      url: 'https://dav.example.com/weeklytodo',
      username: 'alice',
      syncOnStartup: true,
      syncIntervalHours: 4,
    });
    window.localStorage.clear();
  });

  it('sanitizes unknown interval values back to disabled', () => {
    window.localStorage.setItem(
      'weeklyTodo.webdavSettings',
      JSON.stringify({ ...createDefaultWebDavSettings(), syncIntervalHours: 99 }),
    );
    expect(loadWebDavSettings().syncIntervalHours).toBe(0);
    window.localStorage.clear();
  });

  it('validates http/https urls only', () => {
    expect(isValidWebDavUrl('https://dav.example.com/weeklytodo')).toBe(true);
    expect(isValidWebDavUrl('http://127.0.0.1:8080')).toBe(true);
    expect(isValidWebDavUrl('ftp://dav.example.com')).toBe(false);
    expect(isValidWebDavUrl('')).toBe(false);
  });

  it('accepts only the documented interval options', () => {
    expect(isValidIntervalHours(0)).toBe(true);
    expect(isValidIntervalHours(24)).toBe(true);
    expect(isValidIntervalHours(3)).toBe(false);
  });

  it('treats missing lastSyncedAt as due and configured intervals as due later', () => {
    const now = new Date('2026-08-04T12:00:00Z');
    const base = {
      ...createDefaultWebDavSettings(),
      url: 'https://dav.example.com/weeklytodo',
      syncIntervalHours: 4,
    };
    expect(isSyncDue(base, now, 60_000)).toBe(true);
    expect(
      isSyncDue(
        { ...base, syncIntervalHours: 4, lastSyncedAt: '2026-08-04T08:00:00Z' },
        now,
        60_000,
      ),
    ).toBe(true);
    expect(
      isSyncDue(
        { ...base, syncIntervalHours: 4, lastSyncedAt: '2026-08-04T09:00:00Z' },
        now,
        60_000,
      ),
    ).toBe(false);
  });

  it('suppresses automatic synchronization after a restore until the user resumes it', () => {
    const settings = {
      ...createDefaultWebDavSettings(),
      url: 'https://dav.example.com/weeklytodo',
      syncIntervalHours: 1,
      autoSyncPausedAfterRestore: true,
    };
    expect(isSyncDue(settings, new Date('2026-08-04T12:00:00Z'), 60_000)).toBe(false);
  });
});
