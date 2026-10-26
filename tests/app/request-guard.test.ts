import { describe, expect, it } from 'vitest';
import { rejectReason } from '../../lib/app/request-guard';

const base = { method: 'POST', host: 'localhost:3000', origin: 'http://localhost:3000', secFetchSite: 'same-origin' };

describe('rejectReason', () => {
  it('allows localhost POST with matching origin', () => {
    expect(rejectReason(base, 'en')).toBeNull();
  });

  it('rejects foreign host', () => {
    expect(rejectReason({ ...base, host: 'evil.com', origin: 'http://evil.com' }, 'en')).toMatch(/not allowed/);
  });

  it('rejects rebinding host', () => {
    // A domain resolving to 127.0.0.1 has matching Origin and Host but is not a loopback name.
    expect(rejectReason({ ...base, host: 'rebind.example:3000', origin: 'http://rebind.example:3000' }, 'en')).toMatch(/not allowed/);
  });

  it('rejects cross-site fetch', () => {
    expect(rejectReason({ ...base, secFetchSite: 'cross-site' }, 'en')).toMatch(/another site/);
  });

  it('rejects mismatched origin on POST', () => {
    expect(rejectReason({ ...base, origin: 'http://localhost:4000', secFetchSite: null }, 'tr')).toMatch(/Başka bir siteden/);
  });

  it('lets the sandboxed preview frame load its own files (opaque origin, cross-site GET) but nothing else', () => {
    const frame = { method: 'GET', host: 'localhost:3000', origin: null, secFetchSite: 'cross-site' };
    expect(rejectReason({ ...frame, path: '/api/projects/p-1/preview/9x16/assets/player.js' }, 'en')).toBeNull();
    expect(rejectReason({ ...frame, path: '/api/projects/p-1/files/versions/v1/render/final-9x16.mp4' }, 'en')).toMatch(/another site/);
    expect(rejectReason({ ...frame, method: 'POST', origin: 'null', path: '/api/projects/p-1/preview' }, 'en')).toMatch(/another site/);
    expect(rejectReason({ ...frame, method: 'POST', origin: 'null', path: '/api/projects/p-1/preview/9x16/index.html' }, 'en')).toMatch(/another site/);
  });

  it('allows GET without origin', () => {
    expect(rejectReason({ method: 'GET', host: '127.0.0.1:3000', origin: null, secFetchSite: null }, 'en')).toBeNull();
  });

  it('allows a host listed in allowedHosts', () => {
    expect(rejectReason({ ...base, host: 'studio.lan:3000', origin: 'http://studio.lan:3000', allowedHosts: ['studio.lan'] }, 'en')).toBeNull();
  });
});
