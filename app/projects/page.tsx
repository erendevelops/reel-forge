import { getSettings } from '@/lib/app/settings';
import { t } from '@/lib/i18n';

// Placeholder; Task 8 replaces it with the real projects list.
export default async function ProjectsPage() {
  const d = t((await getSettings()).language);
  return <h1 className="font-px text-2xl">{d.projects.title}</h1>;
}
