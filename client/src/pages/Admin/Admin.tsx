/**
 * Staff and devices (administrators only): change what each account may do,
 * and see which tablets are connected and when they last sent their records.
 */
import { useState } from 'react';
import { ROLES, ROLE_LABELS, type DeviceInfo, type PublicUser, type Role } from '@shared/types';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { Avatar, ErrorNotice, OfflineNotice, PageHeader, SectionHeading, SkeletonRows, relativeTime, shortId } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/useI18n';
import { tFacility } from '../../i18n/i18n';
import { tName } from '../../i18n/names';

const ROLE_HELP: Record<Role, string> = {
  health_worker: 'Adds and edits patients at a PHC',
  clinical_reviewer: 'Checks medicine doses that two devices changed',
  admin: 'Manages staff and devices; sees everything',
  auditor: 'Reads the change history only',
};

function DeviceStatus({ online }: { online: boolean }) {
  const { t } = useI18n();
  return online ? (
    <span className="badge-ok">
      <Icon name="wifi" className="h-4 w-4" /> {t('Online')}
    </span>
  ) : (
    <span className="badge-muted">
      <Icon name="wifiOff" className="h-4 w-4" /> {t('Offline')}
    </span>
  );
}

export default function Admin() {
  const { connected } = useSyncEngine();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const users = useApi<{ users: PublicUser[] }>(connected ? '/users' : null, connected);
  const devices = useApi<{ devices: DeviceInfo[] }>(connected ? '/devices' : null, connected);
  const [saving, setSaving] = useState<string | null>(null);
  const { t } = useI18n();

  const changeRole = async (u: PublicUser, role: Role) => {
    setSaving(u.id);
    try {
      const res = await api<{ user: PublicUser }>(`/users/${u.id}/role`, { method: 'PATCH', body: { role } });
      users.setData((prev) => (prev ? { users: prev.users.map((x) => (x.id === u.id ? res.user : x)) } : prev));
      toast({ message: t('{name} is now {role}. It applies at their next sign-in.', { name: tName(u.name), role: t(ROLE_LABELS[role]) }), type: 'success' });
    } catch (err) {
      toast({ message: err instanceof Error ? t(err.message) : t('Could not change role'), type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  if (!connected) {
    return (
      <div>
        <PageHeader title={t('Staff and devices')} />
        <OfflineNotice message={t('Staff and device settings need the internet.')} />
      </div>
    );
  }

  const online = devices.data?.devices.filter((d) => d.online).length ?? 0;

  return (
    <div className="space-y-10">
      <PageHeader title={t('Staff and devices')} subtitle={t('Choose what each person can do, and see which tablets are connected.')} />

      <section aria-labelledby="users-h">
        <SectionHeading id="users-h" icon="users" aside={users.data && t('{count} accounts', { count: users.data.users.length })}>
          {t('Staff accounts')}
        </SectionHeading>
        {users.loading && !users.data ? (
          <SkeletonRows rows={3} />
        ) : users.error ? (
          <ErrorNotice message={`${t('Could not load the staff list:')} ${t(users.error)}`} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {users.data?.users.map((u) => (
              <li key={u.id} className="card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={tName(u.name)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {tName(u.name)}
                      {u.id === me?.id && <span className="ml-2 text-base font-normal text-slate-700 dark:text-slate-300">({t('you')})</span>}
                    </p>
                    <p className="text-base text-slate-700 dark:text-slate-300">{tFacility(u.facility)}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {t('Username')}: <span className="font-mono">{u.username}</span>
                    </p>
                  </div>
                </div>
                <label className="form-label mt-4" htmlFor={`role-${u.id}`}>
                  {t('Job in the system')}
                </label>
                <select
                  id={`role-${u.id}`}
                  className="form-input"
                  value={u.role}
                  disabled={saving === u.id || u.id === me?.id}
                  onChange={(e) => void changeRole(u, e.target.value as Role)}
                  aria-describedby={`role-help-${u.id}`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(ROLE_LABELS[r])}
                    </option>
                  ))}
                </select>
                <p className="form-help" id={`role-help-${u.id}`}>
                  {u.id === me?.id ? t('You cannot change your own job.') : t(ROLE_HELP[u.role])}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="devices-h">
        <SectionHeading id="devices-h" icon="device" aside={devices.data && t('{online} online of {total}', { online, total: devices.data.devices.length })}>
          {t('Tablets and computers')}
        </SectionHeading>
        {devices.loading && !devices.data ? (
          <SkeletonRows rows={2} />
        ) : devices.error ? (
          <ErrorNotice message={`${t('Could not load the devices:')} ${t(devices.error)}`} />
        ) : (
          <div className="card overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  {['Device', 'Health centre', 'Last person', 'Last update', 'Now'].map((h) => (
                    <th key={h} scope="col" className="table-head first:pl-5 sm:first:pl-6">
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {devices.data?.devices.map((d) => (
                  <tr key={d.clientId}>
                    <th scope="row" className="table-cell pl-5 text-left sm:pl-6">
                      <span className="block font-bold">{tName(d.deviceName)}</span>
                      <span className="block font-mono text-xs font-normal text-slate-600 dark:text-slate-400" title={d.clientId}>
                        {shortId(d.clientId)}
                      </span>
                    </th>
                    <td className="table-cell">{tName(d.facility) || '—'}</td>
                    <td className="table-cell font-mono">{d.username}</td>
                    <td className="table-cell whitespace-nowrap">{relativeTime(d.lastSyncAt)}</td>
                    <td className="table-cell">
                      <DeviceStatus online={d.online} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
