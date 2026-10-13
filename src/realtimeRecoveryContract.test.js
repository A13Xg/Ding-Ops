import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync(join(process.cwd(), 'src', 'DingApp.jsx'), 'utf8');

describe('DING realtime recovery contract', () => {
  it('takes an authoritative snapshot when Realtime subscribes or reconnects', () => {
    expect(app).toContain("realtimeStatus === 'SUBSCRIBED'");
    expect(app).toContain('void resyncDashboard()');
    expect(app).toContain("window.addEventListener('online', onOnline)");
    expect(app).toContain("window.removeEventListener('online', onOnline)");
  });

  it('protects an in-flight snapshot from overwriting newer realtime mutations', () => {
    expect(app).toContain('let realtimeRevision = 0');
    expect(app).toContain('const revisionAtStart = realtimeRevision');
    expect(app).toContain('revisionAtStart !== realtimeRevision');
    for (const handler of ['onLevelEvent', 'onCharacter', 'onProfile', 'onAchievement']) {
      const index = app.indexOf(`${handler}:`);
      expect(index).toBeGreaterThan(-1);
      expect(app.slice(index, index + 180)).toContain('realtimeRevision += 1');
    }
  });

  it('surfaces channel failure state while Supabase reconnects', () => {
    expect(app).toContain("realtimeStatus === 'CHANNEL_ERROR'");
    expect(app).toContain("realtimeStatus === 'TIMED_OUT'");
    expect(app).toContain("setStatus('Realtime reconnecting…')");
  });
});
