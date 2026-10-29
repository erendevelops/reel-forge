'use client';

import { useCallback, useEffect, useState } from 'react';
import { SetupList } from '@/components/SetupList';
import { Spinner } from '@/components/Spinner';
import { t } from '@/lib/i18n';
import type { Check } from '@/lib/app/setup/checks';
import type { Language } from '@/lib/i18n';

export function SetupClient({ lang }: { lang: Language }) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setChecks(await (await fetch('/api/setup', { cache: 'no-store' })).json());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function download() {
    setBusy(true);
    try {
      await fetch('/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'download-face-model' }) });
    } finally {
      await load();
    }
  }

  if (!checks) return <Spinner label={t(lang).setup.checking} />;
  return <SetupList lang={lang} checks={checks} busy={busy} onRecheck={load} onDownloadFaceModel={download} />;
}
