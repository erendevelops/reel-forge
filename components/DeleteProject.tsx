'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Deletes a project after a confirm. The card goes away at once (removing big videos can take seconds on Windows /
 * OneDrive) and comes back with an error if the delete fails.
 */
export function DeleteProject({ id, label, busyLabel, confirmText, busyText }: { id: string; label: string; busyLabel: string; confirmText: string; busyText: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove(card: HTMLElement | null) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    if (card) card.style.opacity = '0.35';
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok || res?.status === 404) {
      if (card) card.style.display = 'none';
      router.refresh();
      return;
    }
    setBusy(false);
    if (card) card.style.opacity = '';
    window.alert(res?.status === 409 ? busyText : `${label}: ${(await res?.text().catch(() => '')) || 'failed'}`);
  }
  return (
    <button type="button" className="btn" disabled={busy} onClick={(e) => void remove(e.currentTarget.closest<HTMLElement>('.card'))}>
      {busy ? busyLabel : label}
    </button>
  );
}
