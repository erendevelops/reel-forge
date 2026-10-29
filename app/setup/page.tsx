import { px } from '@/lib/i18n/px';
import { getSettings } from '@/lib/app/settings';
import { t } from '@/lib/i18n';
import { SetupClient } from './SetupClient';

export default async function SetupPage() {
  const { language } = await getSettings();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-px text-2xl">{px(t(language).setup.title)}</h1>
      <SetupClient lang={language} />
    </div>
  );
}
