import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

/** Git installs build via `prepare`; a source checkout can also run the CLI directly. */
export async function loadModule(relativePath) {
  const output = path.join(repositoryRoot, 'dist', relativePath);
  if (!existsSync(output)) {
    const tsc = path.join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    if (!existsSync(tsc)) {
      throw new Error('Dependencies are missing. Run `npm install` in the skill repository first.');
    }
    const result = spawnSync(process.execPath, [tsc, '-p', path.join(repositoryRoot, 'tsconfig.json')], {
      cwd: repositoryRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`TypeScript build failed:\n${result.stdout || ''}${result.stderr}`);
  }
  return import(pathToFileURL(output).href);
}

import { pathToFileURL } from 'node:url';
