/**
 * Staff and devices (administrators only): a table of accounts with what each
 * person may do, and a table of the tablets and when they last sent records.
 */
import { useState } from 'react';
import { ROLES, ROLE_LABELS, type DeviceInfo, type PublicUser, type Role } from '@shared/types';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { ErrorNotice, Loading, OfflineNotice, PageHeader, relativeTime, shortId } from '../../components/ui';
import { useI18n } from '../../i18n/useI18n';
import { tFacility } from '../../i18n/i18n';
import { tName } from '../../i18n/names';

const ROLE_HELP: Record<Role, string> = {
  health_worker: 'Adds and edits patients at a PHC',
  clinical_reviewer: 'Checks medicine doses that two devices changed',
  admin: 'Manages staff and devices; sees everything',
  auditor: 'Reads the change history only',
};

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
    <div>
      <PageHeader caption={t('District hospital')} title={t('Staff and devices')} lead={t('Choose what each person can do, and see which tablets are connected.')} />

      <section className="section" aria-labelledby="users-h">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="users-h" className="heading-l">
            {t('Staff accounts')}
          </h2>
          {users.data && <span className="text-muted">{t('{count} accounts', { count: users.data.users.length })}</span>}
        </div>
        <p className="mt-2 text-muted">{t('A change of job applies the next time that person signs in.')}</p>
        {users.loading && !users.data ? (
          <Loading />
        ) : users.error ? (
          <ErrorNotice message={`${t('Could not load the staff list:')} ${t(users.error)}`} />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="table min-w-[40rem]">
              <thead>
                <tr>
                  <th scope="col">{t('Name')}</th>
                  <th scope="col">{t('Health centre')}</th>
                  <th scope="col">{t('Job in the system')}</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.users.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">
                      <span className="block font-bold">
                        {tName(u.name)}
                        {u.id === me?.id && <span className="font-normal text-muted"> ({t('you')})</span>}
                      </span>
                      <span className="block font-mono text-sm font-normal text-muted">{u.username}</span>
                    </th>
                    <td>{tFacility(u.facility)}</td>
                    <td>
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        {t('Job for {name}', { name: tName(u.name) })}
                      </label>
                      <select
                        id={`role-${u.id}`}
                        className="select"
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
                      <span className="mt-1 block text-sm text-muted" id={`role-help-${u.id}`}>
                        {u.id === me?.id ? t('You cannot change your own job.') : t(ROLE_HELP[u.role])}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section mt-12" aria-labelledby="devices-h">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="devices-h" className="heading-l">
            {t('Tablets and computers')}
          </h2>
          {devices.data && <span className="text-muted">{t('{online} online of {total}', { online, total: devices.data.devices.length })}</span>}
        </div>
        {devices.loading && !devices.data ? (
          <Loading />
        ) : devices.error ? (
          <ErrorNotice message={`${t('Could not load the devices:')} ${t(devices.error)}`} />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="table min-w-[40rem]">
              <thead>
                <tr>
                  <th scope="col">{t('Device')}</th>
                  <th scope="col">{t('Health centre')}</th>
                  <th scope="col">{t('Last person')}</th>
                  <th scope="col">{t('Last update')}</th>
                  <th scope="col">{t('Now')}</th>
                </tr>
              </thead>
              <tbody>
                {devices.data?.devices.map((d) => (
                  <tr key={d.clientId}>
                    <th scope="row">
                      <span className="block font-bold">{tName(d.deviceName)}</span>
                      <span className="block font-mono text-sm font-normal text-muted" title={d.clientId}>
                        {shortId(d.clientId)}
                      </span>
                    </th>
                    <td>{tName(d.facility) || '—'}</td>
                    <td className="font-mono text-sm">{d.username}</td>
                    <td className="whitespace-nowrap">{relativeTime(d.lastSyncAt)}</td>
                    <td>
                      <span className={d.online ? 'status-ok' : 'status-muted'}>{d.online ? t('Online') : t('Offline')}</span>
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
