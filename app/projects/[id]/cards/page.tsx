import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/app/settings';
import { defaultSelection } from '@/lib/app/claude/install';
import { NotFoundError, getProject } from '@/lib/app/workspace/store';
import { CardsClient } from '../CardsClient';

export const dynamic = 'force-dynamic';

/** "Kartları değiştir": the option cards of an already planned project; saving does not start a job. */
export default async function CardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { language } = await getSettings();
  const project = await getProject(id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  return <CardsClient lang={language} project={project} selection={project.selection ?? defaultSelection(project.preset)} after={`/projects/${id}`} />;
}
