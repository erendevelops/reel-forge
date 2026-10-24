import fs from 'node:fs';
import path from 'node:path';

/**
 * Returns [cmd, args] that run `npx <args>` without a shell. On Windows `npx` is a .cmd
 * shim that `spawn` cannot run with `shell: false`, so we call npm's npx-cli.js with node.
 */
export function npx(args: string[]): [string, string[]] {
  const binDir = path.dirname(process.execPath);
  const candidates = [
    path.join(binDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    path.join(binDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ];
  const cli = candidates.find((c) => fs.existsSync(c));
  if (cli) return [process.execPath, [cli, ...args]];
  return ['npx', args];
}
