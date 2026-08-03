import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/main.tsx',
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
  },
  html: {
    title: '周计划',
    favicon: path.resolve(__dirname, 'src-tauri/icons/32x32.png'),
  },
  output: {
    distPath: {
      root: 'dist',
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1421,
    // Keep the port stable so Tauri's devUrl does not miss the server.
    strictPort: true,
  },
});
