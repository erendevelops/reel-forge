import type { NextConfig } from 'next';

const config: NextConfig = {
  // The render core spawns ffmpeg, python and hyperframes; keep these server-only packages unbundled.
  serverExternalPackages: ['simple-icons', 'simple-icons-v13'],
};

export default config;
