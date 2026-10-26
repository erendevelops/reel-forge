import { notFound } from 'next/navigation';
import { listJobs } from '@/lib/app/jobs/jobs';
import { analysisState, hasFinalRender, projectStage } from '@/lib/app/flow';
import { StageBar } from '@/components/StageBar';
import { getSettings } from '@/lib/app/settings';
import { defaultSelection } from '@/lib/app/claude/install';
import { NotFoundError, getProject, listVersions } from '@/lib/app/workspace/store';
import { t } from '@/lib/i18n';
import { ProjectClient } from './ProjectClient';
import { CardsClient } from './CardsClient';
import { TranscriptClient } from './TranscriptClient';
import { MusicClient } from './MusicClient';
import { CandidatesSchema, type Candidate } from '@/lib/app/music';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectDir } from '@/lib/app/workspace/paths';
import { TranscriptSchema, type Transcript } from '@/lib/app/transcript';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { language } = await getSettings();
  const project = await getProject(id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  const [versions, jobs, analysis] = await Promise.all([listVersions(id), listJobs(id), analysisState(id)]);
  const latest = versions.at(-1)?.n;
  const stage = projectStage(project, { analysed: analysis.analysed, hasTranscript: analysis.transcriptFile !== null, versions, rendered: latest ? await hasFinalRender(id, latest) : false });
  const d = t(language).newProject.presets;
  let candidates: Candidate[] = [];
  if (stage === 'music') {
    const raw = await readFile(path.join(projectDir(id), 'analysis', 'music-candidates.json'), 'utf8').catch(() => null);
    candidates = raw ? (CandidatesSchema.safeParse(JSON.parse(raw)).data?.candidates ?? []) : [];
  }
  let transcript: Transcript | null = null;
  if (stage === 'transcript' && analysis.transcriptFile) {
    const raw = await readFile(path.join(projectDir(id), ...analysis.transcriptFile.split('/')), 'utf8').catch(() => null);
    transcript = raw ? TranscriptSchema.parse(JSON.parse(raw)) : null;
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-px text-2xl">{project.name.toLocaleUpperCase(language)}</h1>
        <span className="meta">
          {d[project.preset]} · {project.ratios.join(' ')}
        </span>
      </div>
      <StageBar lang={language} stage={stage} />
      {stage === 'music' ? (
        <MusicClient lang={language} projectId={id} candidates={candidates} picked={project.music} />
      ) : stage === 'transcript' && transcript ? (
        <TranscriptClient lang={language} projectId={id} transcript={transcript} />
      ) : stage === 'cards' ? (
        <CardsClient lang={language} project={project} selection={project.selection ?? defaultSelection(project.preset)} />
      ) : (
        <ProjectClient lang={language} projectId={id} stage={stage} versions={versions} lastJobId={jobs[0]?.jobId ?? null} />
      )}
    </div>
  );
}
