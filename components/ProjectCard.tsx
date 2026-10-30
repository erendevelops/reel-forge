import Link from 'next/link';
import { t, type Language } from '@/lib/i18n';
import type { Project } from '@/lib/app/workspace/schema';
import { DeleteProject } from './DeleteProject';

/** `thumb`: project-relative picture (see `projectThumb`), served by the files route; a plain tile without one. */
export function ProjectCard({ project, lang, thumb }: { project: Project; lang: Language; thumb: string | null }) {
  const d = t(lang).newProject.presets;
  const p = t(lang).projects;
  return (
    <div className="card flex items-center gap-5 px-5 py-4">
      <Link href={`/projects/${project.id}`} className="flex flex-1 items-center gap-5">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local file, nothing to optimise
          <img alt="" src={`/api/projects/${project.id}/files/${thumb}`} className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
        ) : (
          <div className="h-14 w-14 rounded-xl" style={{ background: 'linear-gradient(160deg,#d3dcd7,#9aa8a1)' }} />
        )}
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{project.name}</div>
          <div className="meta">
            {d[project.preset]} · {project.ratios.join(' ')} · {project.lang.toUpperCase()}
          </div>
        </div>
        <span className="meta">{project.updatedAt.slice(0, 10)}</span>
      </Link>
      <DeleteProject id={project.id} label={p.delete} busyLabel={p.deleting} confirmText={p.confirmDelete.replace('{name}', project.name)} busyText={p.deleteBusy} />
    </div>
  );
}
