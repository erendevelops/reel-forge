import { getSettings } from '@/lib/app/settings';
import { getPreferences } from '@/lib/app/workspace/store';
import { workspaceDir } from '@/lib/app/workspace/paths';
import { t } from '@/lib/i18n';
import { SettingsClient } from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await getSettings();
  const prefs = await getPreferences();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-px text-2xl">{t(settings.language).settings.title}</h1>
      <SettingsClient lang={settings.language} rules={prefs.rules} claudeBinary={settings.claudeBinary ?? ''} workspace={workspaceDir()} />
    </div>
  );
}
