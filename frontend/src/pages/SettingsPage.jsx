import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const STATUS_COLORS = { QUEUED: 'bg-gray-100 text-gray-700', RUNNING: 'bg-blue-100 text-blue-800', COMPLETED: 'bg-green-100 text-green-800', FAILED: 'bg-red-100 text-red-800', CANCELLED: 'bg-gray-200 text-gray-500' };

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const load = () => api.get('/jobs', { limit: 50 }).then(setJobs).catch(console.error);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <span className="text-sm text-gray-500">{jobs.filter(j => j.status === 'RUNNING').length} laufend</span>
      </div>
      <div className="space-y-2">
        {jobs.map(j => (
          <div key={j.id} className="card flex items-center gap-4">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[j.status]}`}>{j.status}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{j.type}</p>
              <p className="text-xs text-gray-400">{j.createdBy?.name} · {new Date(j.createdAt).toLocaleString('de-DE')}</p>
            </div>
            {j.status === 'RUNNING' && (
              <div className="w-24 bg-gray-200 rounded-full h-2">
                <div className="bg-[#EE7E00] h-2 rounded-full transition-all" style={{ width: `${j.progress}%` }} />
              </div>
            )}
            {j.error && <span className="text-xs text-red-500 max-w-xs truncate">{j.error}</span>}
            {j.completedAt && <span className="text-xs text-gray-400">{Math.round((new Date(j.completedAt) - new Date(j.startedAt)) / 1000)}s</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
