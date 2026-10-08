import { useState } from 'react';
import { ROLES, ROLE_LABELS, type DeviceInfo, type PublicUser, type Role } from '@shared/types';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { ErrorNotice, OfflineNotice, PageHeader, RoleBadge, SectionHeading, SkeletonRows, initials, relativeTime, shortId } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/useI18n';
import { tFacility } from '../../i18n/i18n';

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
      toast({ message: t('{name} is now {role}. It applies at their next sign-in.', { name: u.name, role: t(ROLE_LABELS[role]) }), type: 'success' });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : t('Could not change role'), type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  if (!connected) {
    return (
      <div>
        <PageHeader title={t('Users & devices')} />
        <OfflineNotice message={t('User and device management needs a connection to the server.')} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t('Users & devices')} subtitle={t('Manage who can do what, and see which devices are syncing.')} />

      <section aria-labelledby="users-h">
        <SectionHeading id="users-h" icon="users" aside={users.data && <span className="text-xs text-slate-400">{t('{count} accounts', { count: users.data.users.length })}</span>}>{t('Users')}</SectionHeading>
        {users.loading && !users.data ? (
          <SkeletonRows rows={3} />
        ) : users.error ? (
          <ErrorNotice message={`${t('Could not load users:')} ${t(users.error)}`} />
        ) : (
          <>
          <ul className="space-y-3 md:hidden">
            {users.data?.users.map((u) => (
              <li key={u.id} className="card p-4 sm:p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{initials(u.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{u.name}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-slate-400">({t('you')})</span>}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400"><span className="font-mono">{u.username}</span> · {tFacility(u.facility)}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <label className="form-label mt-3 text-xs" htmlFor={`role-m-${u.id}`}>{t('Change role')}</label>
                <select
                  id={`role-m-${u.id}`}
                  className="form-input"
                  value={u.role}
                  disabled={saving === u.id || u.id === me?.id}
                  onChange={(e) => void changeRole(u, e.target.value as Role)}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <div className="card hidden overflow-x-auto p-0 sm:p-0 md:block">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <th className="table-head">{t('Name')}</th>
                  <th className="table-head">{t('Username')}</th>
                  <th className="table-head">{t('Facility')}</th>
                  <th className="table-head">{t('Role')}</th>
                  <th className="table-head">{t('Change role')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.data?.users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="table-cell">
                      <span className="flex items-center gap-3 font-semibold text-slate-900 dark:text-white">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{initials(u.name)}</span>
                        <span>{u.name}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-slate-400">({t('you')})</span>}</span>
                      </span>
                    </td>
                    <td className="table-cell font-mono text-xs">{u.username}</td>
                    <td className="table-cell">{tFacility(u.facility)}</td>
                    <td className="table-cell"><RoleBadge role={u.role} /></td>
                    <td className="table-cell">
                      <label className="sr-only" htmlFor={`role-${u.id}`}>{t('Role for {name}', { name: u.name })}</label>
                      <select
                        id={`role-${u.id}`}
                        className="form-input py-1.5 pr-8"
                        value={u.role}
                        disabled={saving === u.id || u.id === me?.id}
                        onChange={(e) => void changeRole(u, e.target.value as Role)}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABELS[r])}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <section aria-labelledby="devices-h">
        <SectionHeading
          id="devices-h"
          icon="device"
          aside={devices.data && <span className="text-xs text-slate-400">{t('{online} online of {total}', { online: devices.data.devices.filter((d) => d.online).length, total: devices.data.devices.length })}</span>}
        >
          {t('Devices')}
        </SectionHeading>
        {devices.loading && !devices.data ? (
          <SkeletonRows rows={2} />
        ) : devices.error ? (
          <ErrorNotice message={`${t('Could not load devices:')} ${t(devices.error)}`} />
        ) : (
          <>
          <ul className="space-y-3 md:hidden">
            {devices.data?.devices.map((d) => (
              <li key={d.clientId} className="card flex items-center gap-3 p-4 sm:p-4">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon name="device" className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{d.deviceName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{d.facility || '—'} · {d.username} · {relativeTime(d.lastSyncAt)}</p>
                </div>
                <DeviceStatus online={d.online} />
              </li>
            ))}
          </ul>
          <div className="card hidden overflow-x-auto p-0 sm:p-0 md:block">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
                <tr>
                  <th className="table-head">{t('Device')}</th>
                  <th className="table-head">{t('PHC')}</th>
                  <th className="table-head">{t('Client id')}</th>
                  <th className="table-head">{t('Last user')}</th>
                  <th className="table-head">{t('Last sync')}</th>
                  <th className="table-head">{t('Status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {devices.data?.devices.map((d) => (
                  <tr key={d.clientId} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="table-cell font-semibold text-slate-900 dark:text-white">{d.deviceName}</td>
                    <td className="table-cell">{d.facility || '—'}</td>
                    <td className="table-cell font-mono text-xs" title={d.clientId}>{shortId(d.clientId)}</td>
                    <td className="table-cell">{d.username}</td>
                    <td className="table-cell">{relativeTime(d.lastSyncAt)}</td>
                    <td className="table-cell"><DeviceStatus online={d.online} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}

function DeviceStatus({ online }: { online: boolean }) {
  const { t } = useI18n();
  return online ? (
    <span className="badge-sage">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sage-500" />
      </span>
      {t('Online')}
    </span>
  ) : (
    <span className="badge-slate">
      <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
      {t('Offline')}
    </span>
  );
}
