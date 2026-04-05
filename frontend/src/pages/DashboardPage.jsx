import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

function ScoreCard({ label, score, change, suffix = '' }) {
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return (
    <div className="card text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1">{Math.round(score)}</p>
      <span className={`badge-${trend} mt-2`}>
        {change > 0 ? '+' : ''}{Math.round(change * 10) / 10}{suffix}
      </span>
    </div>
  );
}

function QuickAction({ label, description, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card text-left hover:border-[#EE7E00] hover:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </button>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const { isPoweruser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  const quickAction = async (name, apiCall) => {
    setActionLoading(name);
    try {
      await apiCall();
      // Refresh dashboard
      const fresh = await api.get('/dashboard');
      setData(fresh);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Dashboard wird geladen...</div>;
  if (!data) return <div className="text-center py-12 text-red-500">Dashboard konnte nicht geladen werden</div>;

  const { scores, trends, overview, regionScores } = data;
  const weekTrends = trends?.vsWeek || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">Schreinerhelden — SEO/AEO/GEO Übersicht</p>
        </div>
        {data.snapshotDate && (
          <span className="text-xs text-gray-400">
            Stand: {new Date(data.snapshotDate).toLocaleDateString('de-DE')}
          </span>
        )}
      </div>

      {/* Gesamt-Score */}
      <div className="card mb-6 text-center bg-gradient-to-r from-orange-50 to-amber-50 border-[#EE7E00]/20">
        <p className="text-sm text-gray-600">Gesamt-Score</p>
        <p className="text-5xl font-bold text-[#EE7E00] mt-1">{Math.round(scores.total)}</p>
        <div className="flex justify-center gap-4 mt-3">
          <span className={`badge-${weekTrends.total?.direction || 'flat'}`}>
            {weekTrends.total?.change > 0 ? '+' : ''}{weekTrends.total?.change || 0} vs. Vorwoche
          </span>
          {trends?.vsMonth?.total && (
            <span className={`badge-${trends.vsMonth.total.direction}`}>
              {trends.vsMonth.total.change > 0 ? '+' : ''}{trends.vsMonth.total.change} vs. Vormonat
            </span>
          )}
        </div>
      </div>

      {/* Drei Säulen */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <ScoreCard label="SEO (40%)" score={scores.seo} change={weekTrends.seo?.change || 0} />
        <ScoreCard label="AEO (30%)" score={scores.aeo} change={weekTrends.aeo?.change || 0} />
        <ScoreCard label="GEO (30%)" score={scores.geo} change={weekTrends.geo?.change || 0} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-gray-500">Keywords Top 3</p>
          <p className="text-xl font-bold mt-1">{overview.keywordsInTop3} <span className="text-sm text-gray-400">/ {overview.keywordsInTop10} Top 10</span></p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">LLM-Erwähnungen</p>
          <p className="text-xl font-bold mt-1">{overview.llmMentionsTotal}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Offene Issues</p>
          <p className="text-xl font-bold mt-1">
            {overview.criticalIssues > 0 && <span className="text-red-600">{overview.criticalIssues} krit.</span>}
            {overview.criticalIssues > 0 && ' / '}
            {overview.openIssues} ges.
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Content veröffentlicht</p>
          <p className="text-xl font-bold mt-1">{overview.contentPublished}</p>
        </div>
      </div>

      {/* Regionen + Quick Actions */}
      <div className="grid grid-cols-3 gap-6">
        {/* Regionen */}
        <div className="col-span-2 card">
          <h2 className="font-bold text-sm mb-3">Regionen-Scores</h2>
          {regionScores && Object.keys(regionScores).length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(regionScores)
                .sort(([,a], [,b]) => b - a)
                .map(([region, score]) => (
                  <div key={region} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <span className="text-sm">{region}</span>
                    <span className={`text-sm font-bold ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {Math.round(score)}
                    </span>
                  </div>
                ))
              }
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Noch keine Regionsdaten. Starte einen Snapshot.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="font-bold text-sm">One-Click-Aktionen</h2>
          {isPoweruser && (
            <>
              <QuickAction
                label="Landingpage erstellen"
                description="Region wählen und generieren"
                onClick={() => navigate('/content')}
              />
              <QuickAction
                label="SEO-Issues fixen"
                description={`${overview.openIssues} offene Issues`}
                onClick={() => quickAction('audit', () => api.post('/audit/autofix'))}
                disabled={actionLoading === 'audit' || overview.openIssues === 0}
              />
              <QuickAction
                label="LLM-Check starten"
                description="Sichtbarkeit bei ChatGPT & Co."
                onClick={() => quickAction('llm', () => api.post('/llm/track'))}
                disabled={actionLoading === 'llm'}
              />
              <QuickAction
                label="Snapshot erstellen"
                description="Aktuellen Stand festhalten"
                onClick={() => quickAction('snapshot', () => api.post('/snapshots/create'))}
                disabled={actionLoading === 'snapshot'}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
