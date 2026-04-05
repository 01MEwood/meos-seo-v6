import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'REDAKTEUR' });

  const load = () => api.get('/users').then(setUsers).catch(console.error);
  useEffect(load, []);

  const create = async () => {
    try { await api.post('/users', form); setShowNew(false); setForm({ email: '', name: '', password: '', role: 'REDAKTEUR' }); load(); }
    catch (e) { alert(e.message); }
  };

  const changeRole = async (id, role) => { await api.put(`/users/${id}`, { role }); load(); };
  const toggleActive = async (id, isActive) => { await api.put(`/users/${id}`, { isActive: !isActive }); load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Nutzerverwaltung</h1>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ Neuer Nutzer</button>
      </div>
      {showNew && (
        <div className="card mb-4 border-[#EE7E00]">
          <div className="grid grid-cols-5 gap-3">
            <input className="input" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input className="input" placeholder="E-Mail" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <input className="input" type="password" placeholder="Passwort" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="REDAKTEUR">Redakteur</option>
              <option value="POWERUSER">Poweruser</option>
              <option value="ADMIN">Admin</option>
            </select>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={create}>Erstellen</button>
              <button className="btn-secondary" onClick={() => setShowNew(false)}>X</button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className={`card flex items-center gap-4 ${!u.isActive ? 'opacity-50' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-medium text-gray-600">{u.name?.charAt(0)}</div>
            <div className="flex-1">
              <p className="font-medium text-sm">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email}</p>
            </div>
            <select className="input w-auto text-sm" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
              <option value="REDAKTEUR">Redakteur</option>
              <option value="POWERUSER">Poweruser</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button onClick={() => toggleActive(u.id, u.isActive)} className={`px-2 py-1 rounded text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {u.isActive ? 'aktiv' : 'inaktiv'}
            </button>
            <span className="text-xs text-gray-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('de-DE') : 'nie'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
