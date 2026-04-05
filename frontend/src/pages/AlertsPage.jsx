import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const load = () => api.get('/alerts', { limit: 100 }).then(setAlerts).catch(console.error);
  useEffect(load, []);

  const markRead = async (id) => { await api.patch(`/alerts/${id}/read`); load(); };
  const markAllRead = async () => { await api.patch('/alerts/read-all'); load(); };

  const unread = alerts.filter(a => !a.isRead).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-sm text-gray-500">{unread} ungelesen</p>
        </div>
        {unread > 0 && <button className="btn-secondary text-sm" onClick={markAllRead}>Alle gelesen</button>}
      </div>
      <div className="space-y-2">
        {alerts.map(a => (
          <div key={a.id} className={`card flex items-center gap-3 ${!a.isRead ? 'border-l-4 border-l-[#EE7E00]' : 'opacity-60'}`} style={{ borderRadius: a.isRead ? undefined : 0 }}>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : a.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              {a.type}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-gray-500">{a.message}</p>
            </div>
            <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString('de-DE')}</span>
            {!a.isRead && <button onClick={() => markRead(a.id)} className="text-xs text-blue-600">Gelesen</button>}
          </div>
        ))}
        {alerts.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Keine Alerts</p>}
      </div>
    </div>
  );
}
