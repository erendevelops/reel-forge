import { afterEach } from 'vitest';

// RTL only auto-cleans with vitest globals; unmount rendered trees between UI tests.
afterEach(async () => {
  if (typeof document === 'undefined') return;
  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
