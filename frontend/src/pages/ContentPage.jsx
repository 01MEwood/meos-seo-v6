import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-700',
  REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-200 text-gray-500',
};

export default function Content() {
  const [content, setContent] = useState([]);
  const [filter, setFilter] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ type: 'LANDINGPAGE', region: 'Stuttgart', service: 'Dachschrägenschrank' });
  const [generating, setGenerating] = useState(false);
  const { isPoweruser } = useAuth();

  const load = () => api.get('/content', filter ? { status: filter } : {}).then(setContent).catch(console.error);
  useEffect(() => { load(); }, [filter]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post('/content/generate', {
        type: genForm.type,
        region: genForm.region,
        service: genForm.service,
      });
      setShowGenerate(false);
      setTimeout(load, 2000);
    } catch (err) { alert(err.message); }
    finally { setGenerating(false); }
  };

  const handlePublish = async (id) => {
    try {
      await api.post(`/content/${id}/publish`);
      setTimeout(load, 2000);
    } catch (err) { alert(err.message); }
  };

  const REGIONS = ['Stuttgart', 'Ludwigsburg', 'Waiblingen', 'Esslingen', 'Böblingen', 'Fellbach', 'Backnang', 'Schorndorf', 'Winnenden', 'Murrhardt', 'Schwäbisch Hall', 'Heilbronn', 'Göppingen', 'Kornwestheim', 'Leonberg', 'Sindelfingen', 'Bietigheim-Bissingen', 'Rems-Murr-Kreis'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="text-sm text-gray-500">{content.length} Einträge</p>
        </div>
        {isPoweruser && (
          <button className="btn-primary" onClick={() => setShowGenerate(true)}>+ Content generieren</button>
        )}
      </div>

      {/* Generator */}
      {showGenerate && (
        <div className="card mb-4 border-[#EE7E00]">
          <h3 className="font-bold text-sm mb-3">One-Click: Content generieren</h3>
          <div className="grid grid-cols-4 gap-3">
            <select className="input" value={genForm.type} onChange={e => setGenForm({...genForm, type: e.target.value})}>
              <option value="LANDINGPAGE">Landingpage</option>
              <option value="BLOG">Blog-Artikel</option>
            </select>
            <select className="input" value={genForm.region} onChange={e => setGenForm({...genForm, region: e.target.value})}>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="input" value={genForm.service} onChange={e => setGenForm({...genForm, service: e.target.value})} placeholder="Service" />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generiert...' : 'Erstellen'}
              </button>
              <button className="btn-secondary" onClick={() => setShowGenerate(false)}>X</button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['', 'DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s || 'Alle'}
          </button>
        ))}
      </div>

      {/* Content-Liste */}
      <div className="space-y-2">
        {content.map(c => (
          <div key={c.id} className="card flex items-center gap-4">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
            <span className="text-xs text-gray-400 w-20">{c.type}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{c.title}</p>
              <p className="text-xs text-gray-400">
                {c.region && `${c.region} · `}
                Score: {c.qualityScore != null ? Math.round(c.qualityScore) : '–'} · 
                {c.createdBy?.name} · {new Date(c.updatedAt).toLocaleDateString('de-DE')}
              </p>
            </div>
            {isPoweruser && c.status === 'APPROVED' && (
              <button onClick={() => handlePublish(c.id)} className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">Veröffentlichen</button>
            )}
            {c.wpUrl && (
              <a href={c.wpUrl} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">Live →</a>
            )}
          </div>
        ))}
        {content.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Noch kein Content vorhanden</p>}
      </div>
    </div>
  );
}
