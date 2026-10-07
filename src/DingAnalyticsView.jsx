import { Activity, Clock3, Gauge, Skull, Trophy, UsersRound } from 'lucide-react';
import { deriveDingAnalytics } from './dingAnalytics.js';
import { activityLabel } from './gameConfig.js';

function maxValue(rows, key = 'count') {
  return Math.max(1, ...rows.map(row => Number(row?.[key]) || 0));
}

function Bars({ rows, valueKey = 'count', label, formatValue = value => value }) {
  const max = maxValue(rows, valueKey);
  return (
    <div className="ding-bars" role="img" aria-label={label}>
      {rows.map((row, index) => {
        const value = Number(row?.[valueKey]) || 0;
        return (
          <div className="ding-bar-row" key={row.key ?? row.label ?? row.hour ?? index}>
            <span>{row.label ?? row.hour}</span>
            <i>
              <b style={{ width: `${Math.max(2, Math.round((value / max) * 100))}%` }} />
            </i>
            <strong>{formatValue(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function Trend({ rows }) {
  const width = 720;
  const height = 180;
  const max = maxValue(rows);
  const points = rows
    .map((row, index) => {
      const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * width;
      const y = height - ((Number(row.count) || 0) / max) * (height - 18) - 9;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div className="ding-trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Thirty day Ding trend">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="ding-trend-axis">
        <span>{rows[0]?.label || '—'}</span>
        <span>{rows.at(-1)?.label || '—'}</span>
      </div>
    </div>
  );
}

function Heatmap({ cells }) {
  const max = maxValue(cells);
  const dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return (
    <div className="ding-heatmap-wrap">
      <div className="ding-heatmap-labels">
        {dayLabels.map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="ding-heatmap" role="img" aria-label="Dings by actor-local weekday and hour">
        {cells.map(cell => (
          <span
            key={`${cell.weekday}:${cell.hour}`}
            title={`${dayLabels[cell.weekday]} ${String(cell.hour).padStart(2, '0')}:00 — ${cell.count} Ding${cell.count === 1 ? '' : 's'}`}
            style={{ '--heat': cell.count ? Math.max(0.18, cell.count / max) : 0.035 }}
          />
        ))}
      </div>
      <div className="ding-heatmap-hours">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

function Record({ icon: Icon, label, value, hint }) {
  return (
    <div className="ding-record mf-frame">
      <Icon />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

function EventIdentity({ event, characters, users }) {
  if (!event) return '—';
  const character = characters.find(row => row.id === event.character_id);
  const user = users.find(row => row.id === event.user_id);
  return [user?.username, character?.name].filter(Boolean).join(' · ') || 'Unknown';
}

export function DingAnalyticsView({ events, users, characters, achievements, viewerId }) {
  const analytics = deriveDingAnalytics({ events, users, characters, achievements, viewerId });
  const records = analytics.records;
  const highestHeat = Math.max(1, ...analytics.heat.map(cell => cell.count));

  return (
    <div className="ding-analytics">
      <div className="ding-stat-grid">
        <div className="stat mf-frame">
          <span>GROUP DINGS</span>
          <strong>{analytics.summary.groupDings}</strong>
          <small>all tracked levels</small>
        </div>
        <div className="stat mf-frame">
          <span>ACTIVE GRINDERS</span>
          <strong>{analytics.summary.activeGrinders}</strong>
          <small>last 7 days</small>
        </div>
        <div className="stat mf-frame">
          <span>TODAY</span>
          <strong>{analytics.summary.today}</strong>
          <small>viewer-local day</small>
        </div>
        <div className="stat mf-frame">
          <span>YOUR RANK</span>
          <strong>{analytics.summary.viewerRank ? `#${analytics.summary.viewerRank}` : '—'}</strong>
          <small>{analytics.summary.viewerStreak} day best streak</small>
        </div>
      </div>

      <div className="ding-analytics-grid">
        <section className="ding-panel mf-frame ding-wide">
          <h2>30-day Ding trend</h2>
          <Trend rows={analytics.trend30} />
        </section>

        <section className="ding-panel mf-frame">
          <h2>Last 7 days</h2>
          <Bars rows={analytics.week} label="Dings during the last seven days" />
        </section>

        <section className="ding-panel mf-frame">
          <h2>Daypart share</h2>
          <Bars rows={analytics.dayparts} label="Dings by actor-local daypart" />
        </section>

        <section className="ding-panel mf-frame ding-wide">
          <h2>Weekday × hour</h2>
          <Heatmap cells={analytics.heat} max={highestHeat} />
        </section>

        <section className="ding-panel mf-frame">
          <h2>Activity split</h2>
          <Bars
            rows={analytics.activities.map(row => ({ ...row, label: activityLabel(row.label) }))}
            label="Dings by activity"
          />
        </section>

        <section className="ding-panel mf-frame">
          <h2>Hour histogram</h2>
          <div className="ding-hour-hist" role="img" aria-label="Dings by actor-local hour">
            {analytics.hours.map(row => {
              const max = maxValue(analytics.hours);
              return (
                <i
                  key={row.hour}
                  title={`${row.hour}:00 — ${row.count}`}
                  style={{ height: `${Math.max(3, (row.count / max) * 100)}%` }}
                >
                  <span>{row.hour % 6 === 0 ? row.hour : ''}</span>
                </i>
              );
            })}
          </div>
        </section>

        <section className="ding-panel mf-frame">
          <h2>Character contribution</h2>
          <Bars
            rows={analytics.characterContribution.slice(0, 12).map(row => ({
              ...row,
              label: `${row.character.name} · ${row.character.class_name || 'Unknown'}`,
            }))}
            label="Dings by character"
          />
        </section>

        <section className="ding-panel mf-frame">
          <h2>App XP ranking</h2>
          <div className="ding-ranking-list">
            {analytics.xpRanking.map((row, index) => (
              <div className="ding-ranking-row" key={row.user.id}>
                <b>#{index + 1}</b>
                <span>
                  <strong>{row.user.username}</strong>
                  <small>{row.rank.name}</small>
                </span>
                <em>{row.rank.xp} XP</em>
              </div>
            ))}
          </div>
        </section>

        <section className="ding-panel mf-frame ding-wide">
          <h2>Your measured pace</h2>
          {analytics.pace.length ? (
            <Bars
              rows={analytics.pace.slice(-20).map(row => ({ ...row, label: `LVL ${row.level}` }))}
              valueKey="minutes"
              label="Minutes spent on your most recent measured levels"
              formatValue={value => `${value}m`}
            />
          ) : (
            <div className="ding-empty">Add “minutes on level” to Dings to unlock pace analytics.</div>
          )}
        </section>
      </div>

      <section className="ding-records">
        <Record
          icon={Gauge}
          label="FASTEST LEVEL"
          value={records.fastest ? `${records.fastest.session_minutes}m` : '—'}
          hint={EventIdentity({ event: records.fastest, characters, users })}
        />
        <Record
          icon={Clock3}
          label="SLOWEST LEVEL"
          value={records.slowest ? `${records.slowest.session_minutes}m` : '—'}
          hint={EventIdentity({ event: records.slowest, characters, users })}
        />
        <Record
          icon={Skull}
          label="MOST DEATHS"
          value={records.highestDeaths ? records.highestDeaths.deaths : '—'}
          hint={EventIdentity({ event: records.highestDeaths, characters, users })}
        />
        <Record
          icon={Activity}
          label="MOST DINGS / DAY"
          value={records.mostInDay?.value ?? '—'}
          hint={records.mostInDay?.key || 'No recorded day'}
        />
        <Record
          icon={Trophy}
          label="TOP CHARACTER"
          value={records.mostActiveCharacter?.character?.name || '—'}
          hint={records.mostActiveCharacter ? `${records.mostActiveCharacter.count} tracked Dings` : 'No tracked Dings'}
        />
        <Record
          icon={UsersRound}
          label="MOST ALTS"
          value={records.mostAlts?.count ?? '—'}
          hint={records.mostAlts?.user?.username || 'No tracked characters'}
        />
      </section>
    </div>
  );
}
