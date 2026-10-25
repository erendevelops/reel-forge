// Dev only: saves the Plan 1 v5 reel fixture as a version of an existing project.
// Usage: npx tsx scripts/seed-v5.ts <projectId>
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { saveVersion } from '../lib/app/workspace/store';

const id = process.argv[2];
if (!id) throw new Error('usage: npx tsx scripts/seed-v5.ts <projectId>');
const plan = JSON.parse(await readFile(path.join(import.meta.dirname, '../spikes/faceless-reel/plan.json'), 'utf8'));
const n = await saveVersion(id, { plan, by: 'claude', parent: null, request: 'seed: Plan 1 v5 reel' });
console.log(`saved v${n}`);
