// Dev only: saves the Plan 1 v5 reel plan as a version of an existing project.
// The project's inputs hold the copied folder (inputs/<folder>/s01.mp4 …), so media paths get that folder prefix.
// Usage: npx tsx scripts/seed-v5.ts <projectId> [inputFolderName]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { saveVersion } from '../lib/app/workspace/store';

const [id, folder = 'public'] = process.argv.slice(2);
if (!id) throw new Error('usage: npx tsx scripts/seed-v5.ts <projectId> [inputFolderName]');
const plan = JSON.parse(await readFile(path.join(import.meta.dirname, '../spikes/faceless-reel/plan.json'), 'utf8'));

const prefix = (p: string) => `${folder}/${p}`;
for (const scene of plan.scenes) {
  for (const shot of scene.shots) shot.src = prefix(shot.src);
  for (const card of scene.cards) {
    for (const [k, v] of Object.entries(card.params)) {
      if (typeof v === 'string' && v.startsWith('ext/')) card.params[k] = prefix(v);
    }
    for (const item of card.params.items ?? []) if (typeof item.logo === 'string' && item.logo.startsWith('ext/')) item.logo = prefix(item.logo);
  }
}
if (plan.voice) plan.voice.src = prefix(plan.voice.src);

const n = await saveVersion(id, { plan, by: 'claude', parent: null, request: 'seed: Plan 1 v5 reel' });
console.log(`saved v${n}`);
