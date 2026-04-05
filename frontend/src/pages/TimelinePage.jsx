import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Timeline() {
  const [snapshots, setSnapshots] = useState([]);
  const [days, setDays] = useState(90);

  useEffect(() => {
    api.get('/snapshots', { days, type: 'DAILY' }).then(setSnapshots).catch(console.error);
  }, [days]);

  const chartData = snapshots.map(s => ({
    date: new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    SEO: Math.round(s.seoScore),
    AEO: Math.round(s.aeoScore),
    GEO: Math.round(s.geoScore),
    Gesamt: Math.round(s.totalScore),
  }));

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const totalChange = latest && first ? Math.round(latest.totalScore - first.totalScore) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Zeitschiene</h1>
          <p className="text-sm text-gray-500">{snapshots.length} Datenpunkte · {totalChange >= 0 ? '+' : ''}{totalChange} Punkte im Zeitraum</p>
        </div>
        <select className="input w-auto text-sm" value={days} onChange={e => setDays(parseInt(e.target.value))}>
          <option value={30}>30 Tage</option>
          <option value={90}>90 Tage</option>
          <option value={180}>180 Tage</option>
          <option value={365}>1 Jahr</option>
        </select>
      </div>

      {chartData.length > 0 ? (
        <>
          <div className="card mb-6" style={{ height: 350 }}>
            <h2 className="font-bold text-sm mb-3">Score-Verlauf</h2>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Gesamt" stroke="#EE7E00" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="SEO" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="AEO" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="GEO" stroke="#EF4444" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Detail-Tabelle */}
          <div className="card">
            <h2 className="font-bold text-sm mb-3">Snapshot-Daten</h2>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Datum</th>
                    <th className="text-right py-2">Gesamt</th>
                    <th className="text-right py-2">SEO</th>
                    <th className="text-right py-2">AEO</th>
                    <th className="text-right py-2">GEO</th>
                    <th className="text-right py-2">Top3</th>
                    <th className="text-right py-2">LLM</th>
                    <th className="text-right py-2">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshots].reverse().map(s => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-1.5">{new Date(s.date).toLocaleDateString('de-DE')}</td>
                      <td className="text-right font-bold text-[#EE7E00]">{Math.round(s.totalScore)}</td>
                      <td className="text-right">{Math.round(s.seoScore)}</td>
                      <td className="text-right">{Math.round(s.aeoScore)}</td>
                      <td className="text-right">{Math.round(s.geoScore)}</td>
                      <td className="text-right">{s.keywordsInTop3}</td>
                      <td className="text-right">{s.llmMentionsTotal}</td>
                      <td className="text-right">{s.issuesOpen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-12 text-gray-400">
          <p>Noch keine Snapshots vorhanden.</p>
          <p className="text-sm mt-2">Erstelle einen Snapshot im Dashboard oder warte auf den täglichen Cronjob (03:00 Uhr).</p>
        </div>
      )}
    </div>
  );
}
