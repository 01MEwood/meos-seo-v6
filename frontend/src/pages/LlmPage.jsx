import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const LLM_COLORS = { CHATGPT: '#10a37f', CLAUDE: '#c96442', PERPLEXITY: '#20808d', GEMINI: '#4285f4', GROK: '#1da1f2' };

export default function LlmTracker() {
  const [results, setResults] = useState([]);
  const [sov, setSov] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [days, setDays] = useState(7);
  const [tracking, setTracking] = useState(false);

  const load = () => {
    api.get('/llm/results', { days }).then(setResults).catch(console.error);
    api.get('/llm/share-of-voice', { days }).then(setSov).catch(console.error);
    api.get('/llm/prompts').then(setPrompts).catch(console.error);
  };
  useEffect(load, [days]);

  const startTrack = async () => {
    setTracking(true);
    try { await api.post('/llm/track'); setTimeout(load, 5000); }
    catch (err) { alert(err.message); }
    finally { setTracking(false); }
  };

  const mentioned = results.filter(r => r.mentioned);
  const positive = mentioned.filter(r => r.sentiment === 'POSITIVE').length;
  const neutral = mentioned.filter(r => r.sentiment === 'NEUTRAL').length;
  const negative = mentioned.filter(r => r.sentiment === 'NEGATIVE').length;

  // Per LLM aggregieren
  const perLlm = {};
  for (const r of results) {
    if (!perLlm[r.llm]) perLlm[r.llm] = { total: 0, mentioned: 0 };
    perLlm[r.llm].total++;
    if (r.mentioned) perLlm[r.llm].mentioned++;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">LLM-Tracker</h1>
          <p className="text-sm text-gray-500">GEO-Sichtbarkeit bei ChatGPT, Claude, Perplexity, Gemini, Grok</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto text-sm" value={days} onChange={e => setDays(parseInt(e.target.value))}>
            <option value={7}>Letzte 7 Tage</option>
            <option value={30}>Letzte 30 Tage</option>
            <option value={90}>Letzte 90 Tage</option>
          </select>
          <button className="btn-primary text-sm" onClick={startTrack} disabled={tracking}>
            {tracking ? 'Läuft...' : 'Tracking starten'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-xs text-gray-500">Erwähnungen</p>
          <p className="text-3xl font-bold">{mentioned.length}</p>
          <p className="text-xs text-gray-400">von {results.length} Checks</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">Share-of-Voice</p>
          <p className="text-3xl font-bold text-[#EE7E00]">{sov?.shareOfVoice || 0}%</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">Sentiment</p>
          <div className="flex justify-center gap-3 mt-2">
            <span className="badge-up">{positive} positiv</span>
            <span className="badge-flat">{neutral} neutral</span>
            <span className="badge-down">{negative} negativ</span>
          </div>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500">Prompts getrackt</p>
          <p className="text-3xl font-bold">{prompts.length}</p>
        </div>
      </div>

      {/* Per LLM */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {Object.entries(perLlm).map(([llm, data]) => (
          <div key={llm} className="card text-center" style={{ borderTopColor: LLM_COLORS[llm] || '#999', borderTopWidth: '3px' }}>
            <p className="text-xs font-medium" style={{ color: LLM_COLORS[llm] }}>{llm}</p>
            <p className="text-xl font-bold mt-1">{data.mentioned}/{data.total}</p>
            <p className="text-xs text-gray-400">{data.total > 0 ? Math.round((data.mentioned / data.total) * 100) : 0}% Sichtbarkeit</p>
          </div>
        ))}
      </div>

      {/* Wettbewerber */}
      {sov?.competitors && Object.keys(sov.competitors).length > 0 && (
        <div className="card mb-6">
          <h2 className="font-bold text-sm mb-3">Wettbewerber-Erwähnungen</h2>
          <div className="flex gap-4">
            {Object.entries(sov.competitors).sort(([,a],[,b]) => b - a).map(([comp, count]) => (
              <div key={comp} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{comp}</span>
                <span className="text-xs text-gray-500">{count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Letzte Ergebnisse */}
      <div className="card">
        <h2 className="font-bold text-sm mb-3">Letzte Ergebnisse</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {mentioned.slice(0, 30).map(r => (
            <div key={r.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg text-sm">
              <span className="w-20 font-medium text-xs" style={{ color: LLM_COLORS[r.llm] }}>{r.llm}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${r.sentiment === 'POSITIVE' ? 'bg-green-100 text-green-700' : r.sentiment === 'NEGATIVE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                {r.sentiment}
              </span>
              <span className="flex-1 truncate text-gray-600">{r.prompt?.prompt}</span>
              {r.position && <span className="text-xs text-gray-400">Pos. {r.position}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
