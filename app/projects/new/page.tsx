import { getSettings } from '@/lib/app/settings';
import { t } from '@/lib/i18n';
import { NewProjectClient } from './NewProjectClient';

export default async function NewProjectPage() {
  const { language } = await getSettings();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-px text-2xl">{t(language).newProject.title}</h1>
      <NewProjectClient lang={language} />
    </div>
  );
}
