// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  createDefaultCloseBehaviorSettings,
  isValidCloseBehavior,
  loadCloseBehaviorSettings,
  saveCloseBehaviorSettings,
} from './closeBehavior';

describe('closeBehavior', () => {
  it('asks the user by default', () => {
    expect(createDefaultCloseBehaviorSettings()).toEqual({ behavior: 'ask' });
  });

  it('round-trips through localStorage', () => {
    saveCloseBehaviorSettings({ behavior: 'minimize-to-tray' });
    expect(loadCloseBehaviorSettings()).toEqual({ behavior: 'minimize-to-tray' });
    window.localStorage.clear();
  });

  it('falls back to asking when stored value is unknown or malformed', () => {
    window.localStorage.setItem(
      'weeklyTodo.closeBehavior',
      JSON.stringify({ behavior: 'not-a-real-behavior' }),
    );
    expect(loadCloseBehaviorSettings()).toEqual({ behavior: 'ask' });
    window.localStorage.clear();

    window.localStorage.setItem('weeklyTodo.closeBehavior', '{broken json');
    expect(loadCloseBehaviorSettings()).toEqual({ behavior: 'ask' });
    window.localStorage.clear();
  });

  it('accepts only the documented behaviors', () => {
    expect(isValidCloseBehavior('ask')).toBe(true);
    expect(isValidCloseBehavior('minimize-to-tray')).toBe(true);
    expect(isValidCloseBehavior('exit')).toBe(true);
    expect(isValidCloseBehavior('quit')).toBe(false);
  });
});
