import { notFound } from 'next/navigation';
import { listJobs } from '@/lib/app/jobs/jobs';
import { getSettings } from '@/lib/app/settings';
import { NotFoundError, getProject, listVersions } from '@/lib/app/workspace/store';
import { t } from '@/lib/i18n';
import { ProjectClient } from './ProjectClient';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { language } = await getSettings();
  const project = await getProject(id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  const [versions, jobs] = await Promise.all([listVersions(id), listJobs(id)]);
  const d = t(language).newProject.presets;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-px text-2xl">{project.name.toLocaleUpperCase(language)}</h1>
        <span className="meta">
          {d[project.preset]} · {project.ratios.join(' ')}
        </span>
      </div>
      <ProjectClient lang={language} projectId={id} versions={versions} lastJobId={jobs[0]?.jobId ?? null} />
    </div>
  );
}
