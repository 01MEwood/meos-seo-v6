import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const SEV_COLORS = { CRITICAL: 'bg-red-100 text-red-800', WARNING: 'bg-yellow-100 text-yellow-800', INFO: 'bg-blue-100 text-blue-800' };

export default function Audit() {
  const [issues, setIssues] = useState([]);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [running, setRunning] = useState(false);

  const load = () => api.get('/audit/issues', { status: statusFilter }).then(setIssues).catch(console.error);
  useEffect(load, [statusFilter]);

  const runAudit = async () => { setRunning(true); try { await api.post('/audit/run'); setTimeout(load, 5000); } catch(e) { alert(e.message); } finally { setRunning(false); } };
  const runAutofix = async () => { setRunning(true); try { await api.post('/audit/autofix'); setTimeout(load, 5000); } catch(e) { alert(e.message); } finally { setRunning(false); } };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">SEO-Agent</h1>
          <p className="text-sm text-gray-500">{issues.length} Issues ({statusFilter})</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={runAudit} disabled={running}>Audit starten</button>
          <button className="btn-primary text-sm" onClick={runAutofix} disabled={running}>Auto-Fix</button>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {['OPEN', 'FIXED', 'IGNORED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{s}</button>
        ))}
      </div>
      <div className="space-y-2">
        {issues.map(i => (
          <div key={i.id} className="card flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEV_COLORS[i.severity]}`}>{i.severity}</span>
            <span className="text-xs text-gray-400 w-32 truncate">{i.type}</span>
            <div className="flex-1">
              <p className="text-sm">{i.description}</p>
              <p className="text-xs text-gray-400 truncate">{i.url}</p>
            </div>
            {i.fixApplied && <span className="text-xs text-green-600">{i.fixApplied}</span>}
          </div>
        ))}
        {issues.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Keine Issues gefunden</p>}
      </div>
    </div>
  );
}
