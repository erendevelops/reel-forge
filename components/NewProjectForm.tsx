'use client';

import { useState } from 'react';
import { t, type Language } from '@/lib/i18n';
import { RATIOS, type Ratio } from '@/lib/plan/schema';
import { PRESETS, type Preset } from '@/lib/app/workspace/schema';

export type NewProjectInput = {
  name: string;
  mode: 'reel' | 'app';
  preset: Preset;
  ratios: Ratio[];
  lang: Language;
  inputs: string[];
};

const DEFAULT_RATIOS: Record<Preset, Ratio[]> = { faceless: ['9:16'], 'talking-head': ['9:16'], 'app-video': ['16:9'] };
const ORDER: Ratio[] = ['9:16', '4:5', '1:1', '16:9'];

export function NewProjectForm({ lang, onSubmit }: { lang: Language; onSubmit: (p: NewProjectInput) => void }) {
  const d = t(lang).newProject;
  const [preset, setPreset] = useState<Preset>('faceless');
  const [name, setName] = useState('');
  const [ratios, setRatios] = useState<Ratio[]>(DEFAULT_RATIOS.faceless);
  const [projectLang, setProjectLang] = useState<Language>(lang);
  const [inputs, setInputs] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);

  function pick(p: Preset) {
    setPreset(p);
    setRatios(DEFAULT_RATIOS[p]);
  }

  function toggle(r: Ratio) {
    setRatios((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : ORDER.filter((x) => x === r || cur.includes(x))));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(d.errors.name);
    setError(null);
    onSubmit({
      name: name.trim(),
      mode: preset === 'app-video' ? 'app' : 'reel',
      preset,
      ratios,
      lang: projectLang,
      inputs: inputs.map((i) => i.trim()).filter(Boolean),
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7">
      <div role="radiogroup" className="grid grid-cols-3 gap-4">
        {PRESETS.map((p) => (
          <label key={p} className="card cursor-pointer px-5 py-6 text-center font-semibold" style={preset === p ? { borderColor: 'var(--brand-d)', boxShadow: '0 0 0 3px rgba(62,207,142,.18)' } : undefined}>
            <input type="radio" name="preset" className="sr-only" checked={preset === p} onChange={() => pick(p)} />
            {d.presets[p]}
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-2">
        <span className="meta">{d.name}</span>
        <input aria-label={d.name} className="card px-4 py-3" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <span className="text-sm" style={{ color: '#e5484d' }}>{error}</span>}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="meta mb-2">{d.ratios}</legend>
        <div className="flex gap-2">
          {ORDER.filter((r) => (RATIOS as readonly string[]).includes(r)).map((r) => (
            <label key={r} className="btn" style={ratios.includes(r) ? { background: 'var(--brand-d)', color: '#fff', borderColor: 'var(--brand-d)' } : undefined}>
              <input type="checkbox" className="sr-only" checked={ratios.includes(r)} onChange={() => toggle(r)} aria-label={r} />
              {r}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="meta">{d.language}</span>
        <select className="card w-40 px-4 py-3" value={projectLang} onChange={(e) => setProjectLang(e.target.value as Language)}>
          <option value="tr">Türkçe</option>
          <option value="en">English</option>
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="meta">{d.inputs}</span>
        {inputs.map((v, i) => (
          <input
            key={i}
            aria-label={`Input ${i + 1}`}
            className="card px-4 py-3 font-mono text-sm"
            value={v}
            onChange={(e) => setInputs((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
        <div>
          <button type="button" className="btn" onClick={() => setInputs((cur) => [...cur, ''])}>
            {d.addInput}
          </button>
        </div>
      </div>

      <div>
        <button type="submit" className="btn btn-primary">
          {d.create}
        </button>
      </div>
    </form>
  );
}
