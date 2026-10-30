import type { NextConfig } from 'next';

const config: NextConfig = {
  // `next dev` builds into its own folder, so a dev server never overwrites the build `npm run app` is serving
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  // The render core spawns ffmpeg, python and hyperframes; keep these server-only packages unbundled.
  serverExternalPackages: ['simple-icons', 'simple-icons-v13'],
  // With middleware (the request guard), Next cuts request bodies at 10 MB; footage imports are gigabytes.
  experimental: { middlewareClientMaxBodySize: '50gb' },
};

export default config;
