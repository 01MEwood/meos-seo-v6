import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Tracking() {
  const [keywords, setKeywords] = useState([]);
  const [regionFilter, setRegionFilter] = useState('');

  useEffect(() => {
    api.get('/tracking/keywords', regionFilter ? { region: regionFilter } : {}).then(setKeywords).catch(console.error);
  }, [regionFilter]);

  const regions = [...new Set(keywords.map(k => k.region))].sort();
  const sorted = [...keywords].sort((a, b) => (a.currentPosition || 999) - (b.currentPosition || 999));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Keyword-Tracking</h1>
          <p className="text-sm text-gray-500">{keywords.length} Keywords</p>
        </div>
        <select className="input w-auto text-sm" value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
          <option value="">Alle Regionen</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="card">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b">
            <tr>
              <th className="text-left py-2">Keyword</th>
              <th className="text-left py-2">Region</th>
              <th className="text-right py-2">Position</th>
              <th className="text-right py-2">Trend</th>
              <th className="text-center py-2">Snippet</th>
              <th className="text-center py-2">AI Overview</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(k => (
              <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 font-medium">{k.keyword}</td>
                <td className="py-2 text-gray-500">{k.region}</td>
                <td className="py-2 text-right">
                  {k.currentPosition ? (
                    <span className={`font-bold ${k.currentPosition <= 3 ? 'text-green-600' : k.currentPosition <= 10 ? 'text-blue-600' : 'text-gray-600'}`}>
                      {k.currentPosition}
                    </span>
                  ) : <span className="text-gray-300">–</span>}
                </td>
                <td className="py-2 text-right">
                  {k.change !== 0 && (
                    <span className={`badge-${k.trend}`}>{k.change > 0 ? '+' : ''}{k.change}</span>
                  )}
                </td>
                <td className="py-2 text-center">{k.positions?.[0]?.hasSnippet ? '✓' : ''}</td>
                <td className="py-2 text-center">{k.positions?.[0]?.hasAiOverview ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
