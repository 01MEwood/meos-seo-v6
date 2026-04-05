import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const CATEGORIES = ['CONTENT', 'SEO', 'AEO', 'GEO', 'GLOBAL'];
const CAT_COLORS = {
  CONTENT: 'bg-teal-100 text-teal-800',
  SEO: 'bg-blue-100 text-blue-800',
  AEO: 'bg-purple-100 text-purple-800',
  GEO: 'bg-orange-100 text-orange-800',
  GLOBAL: 'bg-yellow-100 text-yellow-800',
};

export default function Skills() {
  const [skills, setSkills] = useState([]);
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newSkill, setNewSkill] = useState({ slug: '', name: '', category: 'CONTENT', description: '' });
  const navigate = useNavigate();

  const load = () => api.get('/skills').then(setSkills).catch(console.error);
  useEffect(() => { load(); }, []);

  const filtered = filter ? skills.filter(s => s.category === filter) : skills;

  const handleCreate = async () => {
    try {
      await api.post('/skills', { ...newSkill, config: {} });
      setShowNew(false);
      setNewSkill({ slug: '', name: '', category: 'CONTENT', description: '' });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleToggle = async (slug) => {
    await api.patch(`/skills/${slug}/toggle`);
    load();
  };

  const handleDuplicate = async (slug) => {
    const newSlug = prompt('Slug für die Kopie:', `${slug}-kopie`);
    if (!newSlug) return;
    try {
      await api.post(`/skills/${slug}/duplicate`, { newSlug });
      load();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (slug) => {
    if (!confirm(`Skill "${slug}" wirklich löschen?`)) return;
    try {
      await api.del(`/skills/${slug}`);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Skills-Manager</h1>
          <p className="text-sm text-gray-500">{skills.length} Skills — Alle Logik an einer Stelle</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ Neuer Skill</button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1.5 rounded-lg text-sm ${!filter ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} onClick={() => setFilter('')}>
          Alle ({skills.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = skills.filter(s => s.category === cat).length;
          return (
            <button key={cat} className={`px-3 py-1.5 rounded-lg text-sm ${filter === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} onClick={() => setFilter(filter === cat ? '' : cat)}>
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Neuer Skill Formular */}
      {showNew && (
        <div className="card mb-4 border-[#EE7E00]">
          <h3 className="font-bold text-sm mb-3">Neuen Skill anlegen</h3>
          <div className="grid grid-cols-4 gap-3">
            <input className="input" placeholder="slug (z.B. youtube-desc)" value={newSkill.slug} onChange={e => setNewSkill({ ...newSkill, slug: e.target.value })} />
            <input className="input" placeholder="Name" value={newSkill.name} onChange={e => setNewSkill({ ...newSkill, name: e.target.value })} />
            <select className="input" value={newSkill.category} onChange={e => setNewSkill({ ...newSkill, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={handleCreate}>Erstellen</button>
              <button className="btn-secondary" onClick={() => setShowNew(false)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Skills-Liste */}
      <div className="space-y-2">
        {filtered.map(skill => (
          <div key={skill.slug} className={`card flex items-center gap-4 ${!skill.isActive ? 'opacity-50' : ''}`}>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${CAT_COLORS[skill.category]}`}>
              {skill.category}
            </span>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/skills/${skill.slug}`)}>
              <p className="font-medium text-sm">{skill.name}</p>
              <p className="text-xs text-gray-400">{skill.slug} · v{skill.version} · {skill.dependsOn?.length || 0} Abhängigkeiten</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleToggle(skill.slug)} className={`px-2 py-1 rounded text-xs ${skill.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`} title={skill.isActive ? 'Deaktivieren' : 'Aktivieren'}>
                {skill.isActive ? 'aktiv' : 'inaktiv'}
              </button>
              <button onClick={() => navigate(`/skills/${skill.slug}`)} className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700" title="Bearbeiten">
                Editieren
              </button>
              <button onClick={() => handleDuplicate(skill.slug)} className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600" title="Duplizieren">
                Duplizieren
              </button>
              <button onClick={() => handleDelete(skill.slug)} className="px-2 py-1 rounded text-xs bg-red-100 text-red-700" title="Löschen">
                Löschen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
