'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Deletes a project after a confirm; the list refreshes without it. */
export function DeleteProject({ id, label, confirmText, busyText }: { id: string; label: string; confirmText: string; busyText: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(() => null);
    setBusy(false);
    if (res?.status === 409) window.alert(busyText);
    else if (res?.ok) router.refresh();
  }
  return (
    <button type="button" className="btn" disabled={busy} onClick={() => void remove()}>
      {label}
    </button>
  );
}
