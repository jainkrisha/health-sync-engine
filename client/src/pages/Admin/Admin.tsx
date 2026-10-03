import { useState } from 'react';
import { ROLES, ROLE_LABELS, type DeviceInfo, type PublicUser, type Role } from '@shared/types';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useSyncEngine } from '../../hooks/useSync';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { OfflineNotice, PageHeader, RoleBadge, SkeletonRows, relativeTime, shortId } from '../../components/ui';

export default function Admin() {
  const { connected } = useSyncEngine();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const users = useApi<{ users: PublicUser[] }>(connected ? '/users' : null, connected);
  const devices = useApi<{ devices: DeviceInfo[] }>(connected ? '/devices' : null, connected);
  const [saving, setSaving] = useState<string | null>(null);

  const changeRole = async (u: PublicUser, role: Role) => {
    setSaving(u.id);
    try {
      const res = await api<{ user: PublicUser }>(`/users/${u.id}/role`, { method: 'PATCH', body: { role } });
      users.setData((prev) => (prev ? { users: prev.users.map((x) => (x.id === u.id ? res.user : x)) } : prev));
      toast({ message: `${u.name} is now ${ROLE_LABELS[role]}. It applies at their next sign-in.`, type: 'success' });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Could not change role', type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  if (!connected) {
    return (
      <div>
        <PageHeader title="Users & devices" />
        <OfflineNotice message="User and device management needs a connection to the server." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Users & devices" subtitle="Manage who can do what, and see which devices are syncing." />

      <section aria-labelledby="users-h">
        <h2 id="users-h" className="section-title mb-3">Users</h2>
        {users.loading && !users.data ? (
          <SkeletonRows rows={3} />
        ) : users.error ? (
          <p className="form-error">{users.error}</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-head">Name</th>
                  <th className="table-head">Username</th>
                  <th className="table-head">Facility</th>
                  <th className="table-head">Role</th>
                  <th className="table-head">Change role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.data?.users.map((u) => (
                  <tr key={u.id}>
                    <td className="table-cell font-medium">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                    <td className="table-cell font-mono text-xs">{u.username}</td>
                    <td className="table-cell">{u.facility}</td>
                    <td className="table-cell"><RoleBadge role={u.role} /></td>
                    <td className="table-cell">
                      <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                      <select
                        id={`role-${u.id}`}
                        className="form-input py-1.5"
                        value={u.role}
                        disabled={saving === u.id || u.id === me?.id}
                        onChange={(e) => void changeRole(u, e.target.value as Role)}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="devices-h">
        <h2 id="devices-h" className="section-title mb-3">Devices</h2>
        {devices.loading && !devices.data ? (
          <SkeletonRows rows={2} />
        ) : devices.error ? (
          <p className="form-error">{devices.error}</p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-head">Device</th>
                  <th className="table-head">PHC</th>
                  <th className="table-head">Client id</th>
                  <th className="table-head">Last user</th>
                  <th className="table-head">Last sync</th>
                  <th className="table-head">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {devices.data?.devices.map((d) => (
                  <tr key={d.clientId}>
                    <td className="table-cell font-medium">{d.deviceName}</td>
                    <td className="table-cell">{d.facility || '—'}</td>
                    <td className="table-cell font-mono text-xs" title={d.clientId}>{shortId(d.clientId)}</td>
                    <td className="table-cell">{d.username}</td>
                    <td className="table-cell">{relativeTime(d.lastSyncAt)}</td>
                    <td className="table-cell">{d.online ? <span className="badge-teal">Online</span> : <span className="badge-slate">Offline</span>}</td>
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
