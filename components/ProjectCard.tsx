import { t, type Language } from '@/lib/i18n';
import type { Project } from '@/lib/app/workspace/schema';

export function ProjectCard({ project, lang }: { project: Project; lang: Language }) {
  const d = t(lang).newProject.presets;
  return (
    <a href={`/projects/${project.id}`} className="card flex items-center gap-5 px-5 py-4">
      <div className="h-14 w-14 rounded-xl" style={{ background: 'linear-gradient(160deg,#d3dcd7,#9aa8a1)' }} />
      <div className="flex-1">
        <div className="text-[15px] font-semibold">{project.name}</div>
        <div className="meta">
          {d[project.preset]} · {project.ratios.join(' ')} · {project.lang.toUpperCase()}
        </div>
      </div>
      <span className="meta">{project.updatedAt.slice(0, 10)}</span>
    </a>
  );
}
