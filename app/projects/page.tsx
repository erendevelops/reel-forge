import { ProjectCard } from '@/components/ProjectCard';
import { getSettings } from '@/lib/app/settings';
import { listProjects } from '@/lib/app/workspace/store';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const { language } = await getSettings();
  const d = t(language).projects;
  const projects = await listProjects();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-px text-2xl">{d.title}</h1>
        <a href="/projects/new" className="btn btn-primary">
          {d.new}
        </a>
      </div>
      {projects.length === 0 ? (
        <p className="meta">{d.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} lang={language} />
          ))}
        </div>
      )}
    </div>
  );
}
