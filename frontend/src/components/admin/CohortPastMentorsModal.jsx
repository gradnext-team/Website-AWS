import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { X, Loader2, Plus, GripVertical, Eye, EyeOff, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * CohortPastMentorsModal
 *
 * Per-cohort admin tool for curating the "Past mentors" carousel that
 * appears on the public `/cohort` landing page.
 *
 * Features:
 *   - Multi-select from the full mentor directory
 *   - Drag-and-drop reorder (HTML5 native, no extra deps)
 *   - Per-row Hide toggle: hidden mentors stay in the list (so you can
 *     un-hide them later) but aren't sent to the backend on save, so
 *     they don't appear on the public page
 *
 * Persists to `landing_mentor_ids[]` on the cohort document via
 *   PUT /api/admin/cohort-programs/{cohort_id}/landing-mentors
 */
export default function CohortPastMentorsModal({ cohort, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Mentor directory: [{ id, name, firm, picture_thumbnail, ... }]
  const [directory, setDirectory] = useState([]);
  // Selected lineup: array of { id, hidden:boolean }, order matters.
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  // Drag state
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(
          `${BACKEND_URL}/api/admin/cohort-programs/${cohort.id}/landing-mentors`,
          { withCredentials: true },
        );
        if (cancelled) return;
        setDirectory(Array.isArray(r.data?.mentor_directory) ? r.data.mentor_directory : []);
        setSelected(
          (Array.isArray(r.data?.mentor_ids) ? r.data.mentor_ids : []).map((id) => ({ id, hidden: false })),
        );
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Failed to load mentors');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cohort.id]);

  const directoryById = useMemo(() => {
    const m = {};
    for (const d of directory) m[d.id] = d;
    return m;
  }, [directory]);

  const selectedIdSet = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory
      .filter((m) => !selectedIdSet.has(m.id))
      .filter((m) => {
        if (!q) return true;
        const hay = [
          m.name,
          m.firm,
          m.consulting_firm,
          m.consulting_position,
          m.title,
          m.college,
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
  }, [directory, selectedIdSet, search]);

  const addMentor = (id) => {
    if (selectedIdSet.has(id)) return;
    setSelected((prev) => [...prev, { id, hidden: false }]);
  };
  const removeMentor = (id) => {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  };
  const toggleHidden = (id) => {
    setSelected((prev) => prev.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s)));
  };

  // Drag-and-drop handlers (HTML5 native).
  const onDragStart = (idx) => () => {
    setDragIdx(idx);
  };
  const onDragOver = (idx) => (e) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const onDrop = (idx) => (e) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setSelected((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const onDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Persist ONLY the visible mentors (hidden ones are dropped from
      // the public list — admin can un-hide later by re-adding).
      const visibleIds = selected.filter((s) => !s.hidden).map((s) => s.id);
      await axios.put(
        `${BACKEND_URL}/api/admin/cohort-programs/${cohort.id}/landing-mentors`,
        { mentor_ids: visibleIds },
        { withCredentials: true },
      );
      toast.success('Past mentors lineup saved');
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="cohort-past-mentors-modal"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-semibold">Past mentors · {cohort.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pick mentors to feature on the cohort landing page. Drag to reorder, click the eye icon to hide a mentor without removing them.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto">
            {/* LEFT: Selected lineup with drag-to-reorder */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700">
                  Selected lineup{' '}
                  <span className="text-xs font-normal text-slate-400">({selected.length})</span>
                </h4>
                {selected.length > 0 && (
                  <button
                    onClick={() => setSelected([])}
                    className="text-xs text-slate-500 hover:text-rose-600"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {selected.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400 bg-slate-50 rounded border border-dashed border-slate-200">
                  No mentors selected yet.<br />Pick from the right side to start.
                </div>
              ) : (
                <ul className="space-y-1.5" data-testid="cohort-past-mentors-selected-list">
                  {selected.map((row, idx) => {
                    const m = directoryById[row.id];
                    if (!m) {
                      // Mentor was removed from the directory after being saved.
                      return (
                        <li
                          key={row.id}
                          className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center justify-between"
                        >
                          <span>Unknown mentor (id: {row.id.slice(0, 8)}…) — removed from directory</span>
                          <button
                            onClick={() => removeMentor(row.id)}
                            className="text-amber-700 hover:text-amber-900"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      );
                    }
                    const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;
                    return (
                      <li
                        key={row.id}
                        draggable
                        onDragStart={onDragStart(idx)}
                        onDragOver={onDragOver(idx)}
                        onDrop={onDrop(idx)}
                        onDragEnd={onDragEnd}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-sm bg-white transition-colors ${
                          isDragOver
                            ? 'border-violet-400 bg-violet-50'
                            : row.hidden
                              ? 'border-slate-200 opacity-60'
                              : 'border-slate-200 hover:border-slate-300'
                        }`}
                        data-testid={`cohort-past-mentor-row-${m.id}`}
                      >
                        <GripVertical className="w-4 h-4 text-slate-400 cursor-grab flex-shrink-0" />
                        <span className="text-xs font-mono text-slate-400 w-6 text-right flex-shrink-0">
                          {idx + 1}.
                        </span>
                        <img
                          src={
                            m.picture_thumbnail ||
                            m.picture ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || 'M')}&background=8C9DFF&color=fff&size=64`
                          }
                          alt={m.name}
                          className="w-7 h-7 rounded object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">{m.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {m.consulting_position || m.title || 'Consultant'}
                            {(m.firm || m.consulting_firm) ? `, ${m.firm || m.consulting_firm}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleHidden(row.id)}
                          title={row.hidden ? 'Hidden — click to show' : 'Visible — click to hide'}
                          className={`p-1 rounded ${
                            row.hidden ? 'text-slate-400 hover:text-slate-700' : 'text-slate-600 hover:text-slate-900'
                          }`}
                          data-testid={`cohort-past-mentor-toggle-${m.id}`}
                        >
                          {row.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => removeMentor(row.id)}
                          title="Remove from lineup"
                          className="p-1 text-slate-400 hover:text-rose-600"
                          data-testid={`cohort-past-mentor-remove-${m.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* RIGHT: Available mentors with search */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                Add mentors{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({filteredAvailable.length} available)
                </span>
              </h4>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, firm, role, college…"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-violet-500"
                  data-testid="cohort-past-mentors-search"
                />
              </div>
              <ul className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                {filteredAvailable.length === 0 ? (
                  <li className="text-center py-6 text-xs text-slate-400">
                    {search ? 'No mentors match your search.' : 'All mentors are already in the lineup.'}
                  </li>
                ) : (
                  filteredAvailable.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded border border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 cursor-pointer text-sm"
                      onClick={() => addMentor(m.id)}
                      data-testid={`cohort-past-mentors-add-${m.id}`}
                    >
                      <img
                        src={
                          m.picture_thumbnail ||
                          m.picture ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || 'M')}&background=8C9DFF&color=fff&size=64`
                        }
                        alt={m.name}
                        className="w-7 h-7 rounded object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{m.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {m.consulting_position || m.title || 'Consultant'}
                          {(m.firm || m.consulting_firm) ? `, ${m.firm || m.consulting_firm}` : ''}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400" />
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <p className="text-[11px] text-slate-500">
            {(() => {
              const visible = selected.filter((s) => !s.hidden).length;
              const hidden = selected.length - visible;
              return `${visible} visible · ${hidden} hidden`;
            })()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || loading}
              data-testid="cohort-past-mentors-save"
            >
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Saving…</> : 'Save lineup'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
