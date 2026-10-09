/**
 * BranchGraph — one patient's history drawn like a GitHub commit graph. Each
 * tablet is a branch; commits link to the edits they had already seen (from the
 * vector clocks), so offline edits fork into parallel lanes. When two of them
 * clash on a critical field, both sides join in a merge node on the District
 * review lane, with the two values shown side by side.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildCommitGraph, type GraphNode } from '@shared/historyGraph';
import type {
  AllergyPayload,
  Conflict,
  CreatePayload,
  HistoryCommit,
  MedicationCritical,
  MedicationPayload,
  PatientHistory,
  VitalsPayload,
} from '@shared/types';
import { FIELD_LABELS } from '@shared/mergeEngine';
import { Icon } from '../../components/Icon';
import { ClockView, formatDateTime, relativeTime } from '../../components/ui';
import { OUTCOME_LABEL, OUTCOME_STYLE, RULE_LABEL } from '../../components/auditLabels';
import { useI18n } from '../../i18n/useI18n';
import { t } from '../../i18n/i18n';
import { translateReport } from '../../i18n/reports';
import { tValue } from '../../i18n/clinical';
import './branchGraph.css';
import { tName } from '../../i18n/names';

const LANE_COLORS = ['#b86f52', '#4f7cb0', '#3a8f7a', '#8a8273', '#7d7c45', '#5f8a94'];
const REVIEW_COLOR = 'var(--bg-review)';
const LANE_W = 22;
const PAD = 14;
const NODE_Y = 21; // node centre, from the top of its row
const R = 24; // height of a branch curve

const laneX = (lane: number) => PAD + lane * LANE_W;
const hashOf = (id: string) => id.replace(/-/g, '').slice(0, 7);

function summary(c: HistoryCommit): string {
  if (c.operation === 'create') {
    const p = c.payload as CreatePayload;
    return p.name ? t('Created the record for {name}', { name: tName(p.name) }) : t('Created the record');
  }
  if (c.operation === 'delete') return t('Archived the record');
  const label = t(FIELD_LABELS[c.field ?? ''] ?? c.field ?? 'Record').toLowerCase();
  if (c.field === 'allergies') {
    const p = c.payload as AllergyPayload;
    return p.op === 'add'
      ? t('Added allergy {name} ({severity})', { name: tName(p.allergen), severity: t(p.severity) })
      : t('Removed allergy {name}', { name: tName(p.allergen) });
  }
  if (c.field === 'medications') {
    const p = c.payload as MedicationPayload;
    if (p.op === 'setCritical')
      return p.active
        ? t('Set {name} to {dose}', { name: tName(p.name), dose: `${tValue(p.dosage)}${p.frequency ? `, ${tValue(p.frequency)}` : ''}` })
        : t('Stopped {name}', { name: tName(p.name) });
    return t('Updated {name} dates', { name: tName(p.name) });
  }
  if (c.field === 'vitals') {
    const r = (c.payload as VitalsPayload).reading ?? {};
    const parts = [
      r.bloodPressure && `${t('BP')} ${r.bloodPressure}`,
      r.heartRate && `${t('HR')} ${r.heartRate}`,
      r.temperature && `${r.temperature}°C`,
      r.oxygenSaturation && `SpO₂ ${r.oxygenSaturation}%`,
    ].filter(Boolean);
    return `${t('Recorded vitals')}${parts.length ? `: ${parts.join(', ')}` : ''}`;
  }
  const value = (c.payload as { value?: string }).value;
  return value ? t('Set {field} to "{value}"', { field: label, value }) : t('Changed {field}', { field: label });
}

const dose = (v: MedicationCritical | undefined) =>
  !v ? '—' : v.active ? tValue(v.dosage) || '—' : t('Stopped');

export function BranchGraph({ history }: { history: PatientHistory }) {
  const graph = useMemo(() => buildCommitGraph(history), [history]);
  const index = useMemo(() => new Map(graph.nodes.map((n, i) => [n.id, i])), [graph]);
  const commitById = useMemo(() => new Map(history.commits.map((c) => [c.id, c])), [history]);
  // conflict id -> the two commits it joins
  const sidesOf = useMemo(
    () => new Map(graph.nodes.filter((n) => n.conflict).map((n) => [n.conflict!.id, n.parents])),
    [graph],
  );
  const listRef = useRef<HTMLOListElement>(null);
  const [ys, setYs] = useState<number[]>([]);
  const [height, setHeight] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  useI18n();

  const color = (lane: number) =>
    graph.lanes[lane]?.review ? REVIEW_COLOR : LANE_COLORS[lane % LANE_COLORS.length];
  const laneOfClient = (clientId: string) => graph.lanes.findIndex((l) => l.key === clientId);
  const width = PAD * 2 + Math.max(0, graph.lanes.length - 1) * LANE_W;

  // Node positions follow the rows, whatever height their text needs.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const rows = Array.from(list.children) as HTMLElement[];
      setYs(rows.map((r) => r.offsetTop + NODE_Y));
      setHeight(list.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [graph]);

  const jumpTo = (id: string) => {
    const row = listRef.current?.children[index.get(id) ?? -1] as HTMLElement | undefined;
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.focus({ preventScroll: true });
    setHover(id);
  };

  const edges =
    ys.length === graph.nodes.length
      ? graph.nodes.flatMap((node, ci) =>
          node.parents
            .filter((pid) => index.has(pid))
            .map((pid) => {
              const pi = index.get(pid)!;
              const parent = graph.nodes[pi];
              const xc = laneX(node.lane);
              const yc = ys[ci];
              const xp = laneX(parent.lane);
              const yp = ys[pi];
              let d: string;
              let stroke: string;
              if (parent.lane === node.lane) {
                d = `M${xp},${yp} L${xc},${yc}`;
                stroke = color(node.lane);
              } else {
                const isMerge = node.parents.length > 1;
                // A merge bends in just under the merge node, unless the parent's lane
                // has newer commits in the way; then it leaves the lane straight away.
                const laneBusy = graph.nodes.some(
                  (n, k) => k > ci && k < pi && n.lane === parent.lane,
                );
                const bendNearChild = isMerge && !laneBusy;
                d = bendNearChild
                  ? `M${xp},${yp} L${xp},${yc + R} C${xp},${yc + R * 0.45} ${xc},${yc + R * 0.55} ${xc},${yc}`
                  : `M${xp},${yp} C${xp},${yp - R * 0.45} ${xc},${yp - R * 0.55} ${xc},${yp - R} L${xc},${yc}`;
                stroke = isMerge ? color(parent.lane) : color(node.lane);
              }
              const lit = hover === node.id || hover === pid;
              return { key: `${pid}->${node.id}`, d, stroke, dashed: node.kind === 'pending', lit };
            }),
        )
      : [];

  return (
    <div className="bg-wrap">
      <ul className="bg-legend" aria-label={t('Branches')}>
        {graph.lanes.map((lane, i) => (
          <li key={lane.key} style={{ ['--lane' as string]: color(i) }}>
            <span className="bg-legend-dot" aria-hidden="true" />
            <span className="bg-legend-name">
              <Icon name={lane.review ? 'merge' : 'git'} className="h-3.5 w-3.5" /> {lane.review ? t(lane.label) : tName(lane.label)}
            </span>
            {lane.people.length > 0 && (
              <span className="bg-legend-people">{lane.people.map(tName).join(', ')}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="bg-help">
        {t('Each tablet is a branch. Edits made offline, without seeing each other, run side by side. When two of them change the same dose, both sides merge into District review, where a person decides.')}
      </p>

      <div className="bg-graph" style={{ ['--graph-w' as string]: `${width}px` }}>
        <svg className="bg-svg" width={width} height={height} aria-hidden="true">
          {edges.map((e) => (
            <path
              key={e.key}
              d={e.d}
              fill="none"
              stroke={e.stroke}
              strokeWidth={e.lit ? 3 : 2}
              strokeDasharray={e.dashed ? '5 4' : undefined}
              strokeLinecap="round"
              opacity={hover && !e.lit ? 0.45 : 1}
            />
          ))}
          {ys.length === graph.nodes.length &&
            graph.nodes.map((n, i) => (
              <NodeDot
                key={n.id}
                node={n}
                x={laneX(n.lane)}
                y={ys[i]}
                color={color(n.lane)}
                lit={hover === n.id}
              />
            ))}
        </svg>

        <ol ref={listRef} className="bg-rows">
          {graph.nodes.map((n) => (
            <li
              key={n.id}
              tabIndex={-1}
              className={`bg-row bg-row-${n.kind} ${n.clashes.length ? 'is-clash' : ''} ${hover === n.id ? 'is-lit' : ''}`}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
            >
              {n.commit ? (
                <CommitRow
                  node={n}
                  commit={n.commit}
                  laneColor={color(n.lane)}
                  commitById={commitById}
                  sidesOf={sidesOf}
                  onJump={jumpTo}
                />
              ) : (
                <MergeRow
                  conflict={n.conflict!}
                  pending={n.kind === 'pending'}
                  sides={n.parents.map((id) => commitById.get(id))}
                  colorOf={(c) => (c ? color(laneOfClient(c.clientId)) : REVIEW_COLOR)}
                  onJump={jumpTo}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function NodeDot({
  node,
  x,
  y,
  color,
  lit,
}: {
  node: GraphNode;
  x: number;
  y: number;
  color: string;
  lit: boolean;
}) {
  if (node.kind === 'pending') {
    return (
      <g className="bg-node-pending">
        <circle
          cx={x}
          cy={y}
          r={lit ? 9 : 8}
          fill="var(--bg-surface)"
          stroke="var(--bg-ember)"
          strokeWidth={2}
          strokeDasharray="3 2.5"
        />
        <circle cx={x} cy={y} r={2.5} fill="var(--bg-ember)" />
      </g>
    );
  }
  if (node.kind === 'resolution') {
    return (
      <g>
        <circle
          cx={x}
          cy={y}
          r={lit ? 9 : 8}
          fill="var(--bg-surface)"
          stroke={color}
          strokeWidth={2}
        />
        <circle cx={x} cy={y} r={4} fill="#6e9f86" />
      </g>
    );
  }
  const clash = node.clashes.length > 0;
  return (
    <g>
      {clash && (
        <circle
          cx={x}
          cy={y}
          r={lit ? 10 : 9}
          fill="none"
          stroke="var(--bg-ember)"
          strokeWidth={2}
          opacity={0.9}
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={lit ? 6 : 5}
        fill={color}
        stroke="var(--bg-surface)"
        strokeWidth={2}
      />
    </g>
  );
}

function CommitRow({
  node,
  commit,
  laneColor,
  commitById,
  sidesOf,
  onJump,
}: {
  node: GraphNode;
  commit: HistoryCommit;
  laneColor: string;
  commitById: Map<string, HistoryCommit>;
  sidesOf: Map<string, string[]>;
  onJump: (id: string) => void;
}) {
  const shown = commit.decisions.filter((d) => d.outcome !== 'applied' || d.concurrent);
  useI18n();
  return (
    <>
      <p className="bg-msg">{summary(commit)}</p>
      <div className="bg-meta">
        <code className="bg-hash" title={commit.id}>
          {hashOf(commit.id)}
        </code>
        <span className="bg-branch" style={{ ['--lane' as string]: laneColor }}>
          <Icon name="git" className="h-3 w-3" /> {tName(commit.deviceName)}
        </span>
        <span>{tName(commit.userName)}</span>
        <time
          dateTime={commit.timestamp}
          title={t('Edited {edited} · reached the server {received}', { edited: formatDateTime(commit.timestamp), received: formatDateTime(commit.receivedAt) })}
        >
          {relativeTime(commit.timestamp)}
        </time>
        {node.parents.length > 1 && (
          <span className="badge-slate">{t('Merge of {hashes}', { hashes: node.parents.map(hashOf).join(' + ') })}</span>
        )}
        <span
          className="bg-clock"
          title={t('Vector clock: how many edits from each tablet this one had seen')}
        >
          <ClockView clock={commit.vectorClock} highlight={commit.clientId} />
        </span>
      </div>
      {shown.length > 0 && (
        <div className="bg-decisions">
          {shown.map((d) => (
            <span key={d.id} className={OUTCOME_STYLE[d.outcome] ?? 'badge-slate'} title={translateReport(d.report)}>
              {t(OUTCOME_LABEL[d.outcome] ?? d.outcome)} · {t(RULE_LABEL[d.rule] ?? d.rule)}
            </span>
          ))}
        </div>
      )}
      {node.clashes.map((k) => {
        const otherId = sidesOf.get(k.id)?.find((id) => id !== commit.id);
        const other = otherId ? commitById.get(otherId) : undefined;
        return (
          <p key={k.id} className="bg-clash">
            <Icon name="alert" className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {t('Clashes on')} <b>{t('{name} dose', { name: tName(k.label) })}</b> {t('with')}{' '}
              {other ? (
                <button type="button" className="bg-link" onClick={() => onJump(other.id)}>
                  {t('{hash} from {device}', { hash: hashOf(other.id), device: tName(other.deviceName) })}
                </button>
              ) : (
                t('an edit from another tablet')
              )}
              . {t('Neither had seen the other.')}
            </span>
          </p>
        );
      })}
    </>
  );
}

const CHOICE_TEXT: Record<string, string> = {
  current: 'Kept the first value',
  incoming: 'Took the second value',
  custom: 'Set a new value',
};

function MergeRow({
  conflict,
  pending,
  sides,
  colorOf,
  onJump,
}: {
  conflict: Conflict;
  pending: boolean;
  sides: (HistoryCommit | undefined)[];
  colorOf: (c: HistoryCommit | undefined) => string;
  onJump: (id: string) => void;
}) {
  const [a, b] = sides;
  useI18n();
  const cards = [
    { commit: a, value: conflict.currentValue, tag: t('Stored first') },
    { commit: b, value: conflict.incomingValue, tag: t('Arrived second') },
  ];
  const winner =
    conflict.resolution === 'current' ? 0 : conflict.resolution === 'incoming' ? 1 : -1;
  return (
    <div className="bg-merge">
      <div className="bg-merge-head">
        <Icon name="merge" className="h-4 w-4" />
        <p className="bg-msg">
          {pending ? t('Merge conflict') : t('Merged')} · {t('{name} dose', { name: tName(conflict.label) })}
        </p>
        <span className={pending ? 'badge-conflict' : 'badge-sage'}>
          {pending ? t('Waiting for review') : t('Resolved by {name}', { name: tName(conflict.resolvedByName) ?? t('reviewer') })}
        </span>
      </div>
      <div className="bg-diff">
        {cards.map((s, i) => (
          <div
            key={i}
            className={`bg-side ${winner === i ? 'is-kept' : ''} ${winner !== -1 && winner !== i && !pending ? 'is-dropped' : ''}`}
            style={{ ['--lane' as string]: colorOf(s.commit) }}
          >
            <span className="bg-side-head">
              <Icon name="git" className="h-3 w-3" /> {tName(s.commit?.deviceName) || t('Unknown tablet')}
              {s.commit && (
                <button
                  type="button"
                  className="bg-link bg-hash"
                  onClick={() => onJump(s.commit!.id)}
                >
                  {hashOf(s.commit.id)}
                </button>
              )}
            </span>
            <span className="bg-side-value">{dose(s.value)}</span>
            <span className="bg-side-sub">
              {s.value?.active ? tValue(s.value.frequency) : t('medicine stopped')} ·{' '}
              {tName(s.commit?.userName) || '—'} · {s.tag}
            </span>
          </div>
        ))}
        <span className="bg-vs" aria-hidden="true">
          {t('vs')}
        </span>
      </div>
      {pending ? (
        <p className="bg-merge-foot">
          {t('The record keeps the stored dose until someone decides.')}{' '}
          <Link to="/conflicts" className="bg-link">
            {t('Open in Conflict Review')} <Icon name="arrowRight" className="inline h-3 w-3" />
          </Link>
        </p>
      ) : (
        <p className="bg-merge-foot">
          <Icon name="checkCircle" className="inline h-3.5 w-3.5 text-sage-600" />{' '}
          {t(CHOICE_TEXT[conflict.resolution ?? ''] ?? 'Resolved')}:{' '}
          <b>
            {dose(conflict.resolvedValue)}
            {conflict.resolvedValue?.active && conflict.resolvedValue.frequency
              ? `, ${tValue(conflict.resolvedValue.frequency)}`
              : ''}
          </b>
          {conflict.resolvedAt && <> · {relativeTime(conflict.resolvedAt)}</>}
          {conflict.note && <span className="bg-note">“{conflict.note}”</span>}
        </p>
      )}
    </div>
  );
}
