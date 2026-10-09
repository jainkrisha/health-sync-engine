/**
 * PHC library — every Primary Health Centre as a book on a shelf. Picking a
 * book brings it forward and opens the cover; the first page is the PHC's
 * overview, and scrolling (or the arrows) turns the pages: staff, devices,
 * patients, and the week's sync activity with open conflicts.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ROLE_LABELS, type PhcSummary } from '@shared/types';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorNotice, OfflineNotice, PageHeader, formatDate, relativeTime } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { dateLocale, t, tp } from '../../i18n/i18n';
import './phcs.css';
import { tName } from '../../i18n/names';

const COVERS: [string, string][] = [
  ['#2b3d55', '#1d2733'],
  ['#b0705a', '#7d4a39'],
  ['#3f6f63', '#274a41'],
  ['#b0843a', '#7d5a22'],
  ['#4f6378', '#2f3f50'],
  ['#7a3b3b', '#4f2424'],
];

function coverFor(name: string): CSSProperties {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [c1, c2] = COVERS[h % COVERS.length];
  return { ['--c1' as string]: c1, ['--c2' as string]: c2 };
}

function Emblem({ size = 54 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M21 13h6v8h8v6h-8v8h-6v-8h-8v-6h8z" fill="currentColor" />
    </svg>
  );
}

function CoverArt({ phc }: { phc: PhcSummary }) {
  return (
    <div className="cover-art" style={coverFor(phc.name)}>
      <p className="cover-kicker">HEALTHSYNC · {t('PHC REGISTER')}</p>
      <p className="cover-title">{tName(phc.name)}</p>
      <div className="cover-emblem">
        <Emblem />
      </div>
      <div className="cover-foot">
        <span>{tp(phc.patientCount, '{count} PATIENT', '{count} PATIENTS')}</span>
        <span>{t('{count} STAFF', { count: phc.staff.length })}</span>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-lg bg-[rgba(29,39,51,0.05)] px-3 py-2.5">
      <p className="text-xl font-extrabold tabular-nums leading-none text-[#1d2733]">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-[rgba(29,39,51,0.6)]">{t(label)}</p>
    </div>
  );
}

/** Content pages, in reading order. */
function pagesFor(phc: PhcSummary): { kicker: string; title: string; body: ReactNode }[] {
  const online = phc.devices.filter((d) => d.online).length;
  const max = Math.max(1, ...phc.activity.map((a) => a.count));
  return [
    {
      kicker: t('Chapter 1 · Overview'),
      title: tName(phc.name),
      body: (
        <>
          <p className="text-[13px] leading-6 text-[rgba(29,39,51,0.75)]">
            {phc.since
              ? t('A Primary Health Centre in the district network, on HealthSync since {date}.', { date: formatDate(phc.since) })
              : t('A Primary Health Centre in the district network.')}{' '}
            {t('Records are kept encrypted on its devices and merged with the district when they sync.')}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat value={phc.patientCount} label="patients registered" />
            <Stat value={phc.staff.length} label="staff accounts" />
            <Stat value={`${online}/${phc.devices.length}`} label="devices online" />
            <Stat value={phc.openConflicts.length} label="doses under review" />
          </div>
          <p className="mt-4 text-[12px] text-[rgba(29,39,51,0.65)]">
            {t('Last sync')} <b className="text-[#1d2733]">{relativeTime(phc.lastSyncAt)}</b> · {t('{count} changes this week', { count: phc.syncedThisWeek })}
          </p>
        </>
      ),
    },
    {
      kicker: t('Chapter 2 · People'),
      title: t('Staff'),
      body: phc.staff.length ? (
        <ul className="divide-y divide-dashed divide-[rgba(29,39,51,0.2)]">
          {phc.staff.map((s) => (
            <li key={s.username} className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2b3d55] text-[11px] font-bold text-[#f4efe3]">
                {tName(s.name).replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{tName(s.name)}</span>
                <span className="block font-mono text-[11px] text-[rgba(29,39,51,0.6)]">{s.username}</span>
              </span>
              <span className="font-mono text-[9px] font-bold tracking-wider text-[#423d35]">{t(ROLE_LABELS[s.role]).toUpperCase()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[rgba(29,39,51,0.6)]">{t('No staff accounts yet.')}</p>
      ),
    },
    {
      kicker: t('Chapter 3 · Equipment'),
      title: t('Devices'),
      body: phc.devices.length ? (
        <ul className="space-y-2">
          {phc.devices.map((d) => (
            <li key={d.clientId} className="flex items-center gap-3 rounded-lg bg-[rgba(29,39,51,0.05)] px-3 py-2.5">
              <Icon name="device" className="h-4 w-4 text-[#2b3d55]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{tName(d.deviceName)}</span>
                <span className="block text-[11px] text-[rgba(29,39,51,0.6)]">
                  {d.username} · {t('synced {when}', { when: relativeTime(d.lastSyncAt) })}
                </span>
              </span>
              <span className={`flex items-center gap-1 text-[11px] font-semibold ${d.online ? 'text-[#2f7a5f]' : 'text-[rgba(29,39,51,0.5)]'}`}>
                <span className={`h-2 w-2 rounded-full ${d.online ? 'bg-[#2f9a72]' : 'bg-[rgba(29,39,51,0.3)]'}`} />
                {d.online ? t('Online') : t('Offline')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[rgba(29,39,51,0.6)]">{t('No devices have synced yet.')}</p>
      ),
    },
    {
      kicker: t('Chapter 4 · Register'),
      title: t('Patients'),
      body: phc.recentPatients.length ? (
        <>
          <p className="mb-2 text-[12px] text-[rgba(29,39,51,0.6)]">{tp(phc.patientCount, 'Most recently updated of {count} patient', 'Most recently updated of {count} patients')}</p>
          <ul className="divide-y divide-dashed divide-[rgba(29,39,51,0.2)]">
            {phc.recentPatients.map((p) => (
              <li key={p.id}>
                <Link to={`/patients/${p.id}`} className="flex items-center gap-2 py-2 text-[13px] font-semibold hover:text-[#22665a]">
                  <span className="flex-1 truncate">{tName(p.name)}</span>
                  {p.needsReview && <span className="text-[10px] font-bold text-[#8a5a0b]">{t('REVIEW')}</span>}
                  <span className="text-[11px] font-normal text-[rgba(29,39,51,0.55)]">{relativeTime(p.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[13px] text-[rgba(29,39,51,0.6)]">{t('No patients registered from this PHC yet.')}</p>
      ),
    },
    {
      kicker: t('Chapter 5 · This week'),
      title: t('Sync activity'),
      body: (
        <>
          <div className="flex h-32 items-end gap-2" role="img" aria-label={`${t('Changes synced per day:')} ${phc.activity.map((a) => a.count).join(', ')}`}>
            {phc.activity.map((a) => (
              <div key={a.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-[rgba(29,39,51,0.6)]">{a.count || ''}</span>
                <span className="w-full rounded-t bg-[#2b3d55]" style={{ height: `${Math.max(3, (a.count / max) * 96)}px` }} />
                <span className="font-mono text-[9px] text-[rgba(29,39,51,0.55)]">
                  {new Date(`${a.date}T00:00:00`).toLocaleDateString(dateLocale(), { weekday: 'narrow' })}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-[rgba(29,39,51,0.65)]">{tp(phc.syncedThisWeek, '{count} change reached the district in the last 7 days.', '{count} changes reached the district in the last 7 days.')}</p>
        </>
      ),
    },
    {
      kicker: t('Chapter 6 · Attention'),
      title: t('Open conflicts'),
      body: phc.openConflicts.length ? (
        <>
          <ul className="space-y-2">
            {phc.openConflicts.map((c, i) => (
              <li key={i} className="rounded-lg border border-[#e6d3a3] bg-[#f8f0dc] px-3 py-2 text-[13px]">
                <b>{tName(c.patientName)}</b> · {tName(c.label)}
                <span className="block text-[11px] text-[rgba(29,39,51,0.6)]">{t('raised {when}', { when: relativeTime(c.createdAt) })}</span>
              </li>
            ))}
          </ul>
          <Link to="/conflicts" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#22665a] hover:underline">
            {t('Open conflict review')} <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        </>
      ) : (
        <p className="text-[13px] text-[rgba(29,39,51,0.65)]">{t('Nothing waiting. Every dose from this PHC is settled.')}</p>
      ),
    },
  ];
}

function Page({ n, side, kicker, title, children }: { n: number; side: 'left' | 'right'; kicker: string; title: string; children: ReactNode }) {
  return (
    <div className={`page relative h-full ${side === 'left' ? 'left' : ''}`}>
      <p className="page-kicker">{kicker}</p>
      <h3 className="page-title">{title}</h3>
      <div className="page-rule" />
      <div className="max-h-[calc(100%-120px)] overflow-hidden">{children}</div>
      <span className={`page-num ${side === 'left' ? 'left-6' : 'right-6'}`}>{n}</span>
    </div>
  );
}

function OpenBook({ phc, onClose }: { phc: PhcSummary; onClose: () => void }) {
  // Rebuilt on every render so a language switch reaches the open book.
  useI18n();
  const pages = pagesFor(phc);
  // Leaves: the cover, then one leaf per pair of pages (front = right page, back = next left page).
  const leaves = (() => {
    const out: { front: ReactNode; back: ReactNode }[] = [];
    out.push({
      front: <CoverArt phc={phc} />,
      back: (
        <div className="page left flex h-full flex-col items-center justify-center text-center" style={{ background: 'linear-gradient(180deg,#efe7d6,#e4dac4)' }}>
          <span className="text-[#2b3d55]"><Emblem size={64} /></span>
          <p className="mt-4 font-mono text-[10px] tracking-[2px] text-[rgba(29,39,51,0.6)]">{t('THIS REGISTER BELONGS TO')}</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-[#1d2733]">{tName(phc.name)}</p>
          <p className="mt-6 max-w-[16rem] text-[12px] leading-5 text-[rgba(29,39,51,0.6)]">{t('Scroll or use the arrows to turn the page.')}</p>
        </div>
      ),
    });
    for (let i = 0; i < pages.length; i += 2) {
      const a = pages[i];
      const b = pages[i + 1];
      out.push({
        front: (
          <Page n={i + 1} side="right" kicker={a.kicker} title={a.title}>
            {a.body}
          </Page>
        ),
        back: b ? (
          <Page n={i + 2} side="left" kicker={b.kicker} title={b.title}>
            {b.body}
          </Page>
        ) : (
          <div className="page left h-full" />
        ),
      });
    }
    return out;
  })();

  // turned = number of leaves flipped to the left (0 = closed book).
  const [turned, setTurned] = useState(0);
  const max = leaves.length;
  const go = useCallback((d: number) => setTurned((t) => Math.min(max, Math.max(0, t + d))), [max]);

  // Open the cover once the book has come forward.
  useEffect(() => {
    const t = setTimeout(() => setTurned(1), 650);
    return () => clearTimeout(t);
  }, []);

  // Scroll turns pages (with a small threshold so one flick = one page).
  const acc = useRef(0);
  const lock = useRef(0);
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Date.now() < lock.current) return;
      acc.current += e.deltaY;
      if (Math.abs(acc.current) > 60) {
        go(acc.current > 0 ? 1 : -1);
        acc.current = 0;
        lock.current = Date.now() + 650;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => {
      const dy = touchY - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 40) go(dy > 0 ? 1 : -1);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  const spreadLabel = turned === 0 ? t('Cover') : turned === 1 ? t('Overview') : t('Pages {from}–{to}', { from: turned * 2 - 2, to: turned * 2 - 1 });

  return createPortal(
    <div className="book-stage" role="dialog" aria-modal="true" aria-label={t('{name} register', { name: tName(phc.name) })}>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[2px] text-[#7a5a3a] dark:text-[#d9c7a8]">{t('PHC REGISTER')}</p>
          <p className="truncate text-lg font-extrabold tracking-tight text-[#1d2733] dark:text-[#f4efe3]">{tName(phc.name)}</p>
        </div>
        <button type="button" onClick={onClose} className="btn bg-[#1d2733] text-[#f4efe3] hover:bg-[#2b3d55]" autoFocus>
          <Icon name="x" className="h-4 w-4" /> {t('Close')}
        </button>
      </div>

      <div className={`book ${turned === 0 ? 'is-closed' : 'is-open'}`} style={coverFor(phc.name)}>
        <div className="book-back" />
        {leaves.map((leaf, i) => {
          const isTurned = i < turned;
          return (
            <div
              key={i}
              className={`leaf ${isTurned ? 'is-turned' : ''}`}
              style={{ zIndex: isTurned ? i + 1 : max - i + 1 }}
              aria-hidden={!(i === turned || i === turned - 1)}
            >
              <div
                className="leaf-face front turnable"
                style={i === 0 ? { borderRadius: '3px 6px 6px 3px', boxShadow: '0 40px 60px -24px rgba(40,25,10,0.6)' } : undefined}
                onClick={(e) => !(e.target as HTMLElement).closest('a,button') && go(1)}
                title={t('Turn the page')}
              >
                {leaf.front}
              </div>
              <div
                className="leaf-face back turnable"
                onClick={(e) => !(e.target as HTMLElement).closest('a,button') && go(-1)}
                title={t('Turn back')}
              >
                {leaf.back}
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-4 py-5">
        <button type="button" className="btn-icon bg-white/80 text-[#1d2733] shadow-card hover:bg-white" onClick={() => go(-1)} disabled={turned === 0} aria-label={t('Previous page')}>
          <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
        </button>
        <span className="min-w-[8rem] text-center font-mono text-[11px] tracking-[1.5px] text-[#4f3a26] dark:text-[#d9c7a8]" aria-live="polite">
          {spreadLabel.toUpperCase()}
        </span>
        <button type="button" className="btn-icon bg-white/80 text-[#1d2733] shadow-card hover:bg-white" onClick={() => go(1)} disabled={turned === max} aria-label={t('Next page')}>
          <Icon name="chevronRight" className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default function PhcLibrary() {
  const { connected } = useSyncEngine();
  const { data, loading, error, reload } = useApi<{ phcs: PhcSummary[] }>(connected ? '/phcs' : null, connected);
  const [open, setOpen] = useState<PhcSummary | null>(null);
  const { lang } = useI18n();
  const phcs = useMemo(() => data?.phcs ?? [], [data]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const phcsRef = useRef(phcs);
  useEffect(() => {
    phcsRef.current = phcs;
  });

  // The 3D shelf runs in its own page; it asks for the PHC list and hands back the one picked.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frameRef.current?.contentWindow) return;
      const msg = e.data as { type?: string; name?: string };
      if (msg.type === 'shelf-ready') {
        frameRef.current?.contentWindow?.postMessage({ type: 'shelf-data', phcs: phcsRef.current }, location.origin);
      } else if (msg.type === 'shelf-open') {
        const p = phcsRef.current.find((x) => x.name === msg.name);
        if (p) setOpen(p);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const closeBook = () => {
    setOpen(null);
    frameRef.current?.contentWindow?.postMessage({ type: 'shelf-close' }, location.origin);
  };

  return (
    <div>
      <PageHeader title={t('PHC library')} subtitle={t('Every Primary Health Centre in the district, as a register on the shelf. Pick a book, then open its register.')} />

      {!connected ? (
        <OfflineNotice message={t('The PHC library is built from the district server. Connect to open it.')} />
      ) : error ? (
        <ErrorNotice message={`${t('Could not load PHCs:')} ${t(error)}`} onRetry={() => void reload()} />
      ) : loading && !data ? (
        <div className="phc-shelf-frame skeleton" aria-busy="true" aria-label={t('Loading the shelf')} />
      ) : phcs.length === 0 ? (
        <div className="card">
          <EmptyState icon="clinic" title={t('No PHCs yet')} message={t('PHCs appear here once a doctor signs up with a PHC name.')} />
        </div>
      ) : (
        <div className="phc-shelf-frame">
          <iframe key={lang} ref={frameRef} src="/bookshelf.html" title={`${t('PHC library shelf')}: ${tp(phcs.length, '{count} PHC', '{count} PHCs')}`} className="h-full w-full border-0" />
        </div>
      )}

      {open && <OpenBook phc={open} onClose={closeBook} />}
    </div>
  );
}
