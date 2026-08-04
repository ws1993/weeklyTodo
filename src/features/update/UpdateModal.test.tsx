// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateModal } from './UpdateModal';

const mockedNativeBridge = vi.hoisted(() => ({
  checkForAppUpdate: vi.fn(),
  downloadAndInstallUpdate: vi.fn(),
  exitAppForUpdate: vi.fn(),
  openReleasePage: vi.fn(),
  subscribeUpdateDownloadProgress: vi.fn(() => () => undefined),
}));

vi.mock('../../api/nativeBridge', () => mockedNativeBridge);
vi.mock('../settings/proxySettings', () => ({
  getSavedProxyConfig: vi.fn(() => undefined),
}));

describe('UpdateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNativeBridge.downloadAndInstallUpdate.mockResolvedValue('installer.exe');
  });

  it('closes the app automatically after the download completes', async () => {
    render(
      <UpdateModal
        open
        onClose={vi.fn()}
        preloaded={{
          available: true,
          version: '0.9.2',
          body: '修复更新问题',
          downloadUrl: 'https://example.com/weeklytodo-setup.exe',
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '下载并安装' }));

    await waitFor(() => {
      expect(mockedNativeBridge.exitAppForUpdate).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('button', { name: '立即关闭并安装' })).toBeNull();
  });
});
