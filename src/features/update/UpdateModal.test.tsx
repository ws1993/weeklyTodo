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

  it('shows an install-ready state after the download completes', async () => {
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
      expect(screen.getByText('更新包已下载')).toBeTruthy();
    });
    expect(screen.getByText('关闭应用后将自动开始安装。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '立即关闭并安装' })).toBeTruthy();
  });

  it('closes the app when the user chooses immediate installation', async () => {
    render(
      <UpdateModal
        open
        onClose={vi.fn()}
        preloaded={{
          available: true,
          version: '0.9.2',
          downloadUrl: 'https://example.com/weeklytodo-setup.exe',
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '下载并安装' }));
    const installButton = await screen.findByRole('button', { name: '立即关闭并安装' });
    fireEvent.click(installButton);

    expect(mockedNativeBridge.exitAppForUpdate).toHaveBeenCalledOnce();
  });
});
