import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Edit3, Archive, Loader2, Calendar, Users, Trash2,
  CheckCircle2, X, Phone, MessageSquare, ExternalLink, UserSquare,
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import CohortPastMentorsModal from './CohortPastMentorsModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Admin Cohort Programs Manager.
 *
 * Three internal tabs:
 *   1. Cohorts       — list / create / edit / archive cohort programs
 *                      (each cohort owns its own sessions list)
 *   2. Enrollments   — per-cohort list of enrolled candidates
 *   3. Discovery     — public cohort discovery-call requests, with
 *                      schedule / mark-completed / cancel actions
 */
const CohortProgramsAdmin = () => {
  const [tab, setTab] = useState('cohorts');
  return (
    <div className="space-y-4" data-testid="cohort-programs-admin">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cohort Programs</h1>
        <p className="text-sm text-slate-500">
          Paid cohort programs (e.g. Case Interview Sprint). Manage curriculum, enrollments, and discovery-call requests.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: 'cohorts', label: 'Cohorts' },
          { id: 'enrollments', label: 'Enrollments' },
          { id: 'discovery', label: 'Discovery Calls' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`cohort-admin-tab-${t.id}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cohorts' && <CohortsList />}
      {tab === 'enrollments' && <EnrollmentsList />}
      {tab === 'discovery' && <DiscoveryCallsList />}
    </div>
  );
};


/* ============= Cohorts list + edit ============= */

function CohortsList() {
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | cohort object
  const [pastMentorsFor, setPastMentorsFor] = useState(null); // null | cohort object
  const [acceptEnrolments, setAcceptEnrolments] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/cohort-programs`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/admin/cohort-programs/landing-settings`, { withCredentials: true }),
      ]);
      setCohorts(r.data?.cohorts || []);
      setAcceptEnrolments(s.data?.accept_enrolments !== false);
    } catch (e) {
      toast.error('Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggleAcceptEnrolments = async (next) => {
    setSavingToggle(true);
    setAcceptEnrolments(next);
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/cohort-programs/landing-settings`,
        { accept_enrolments: next },
        { withCredentials: true },
      );
      toast.success(next ? 'Landing page now accepting enrolments' : 'Enrolments paused on landing page');
    } catch (e) {
      setAcceptEnrolments(!next); // revert
      toast.error(e?.response?.data?.detail || 'Toggle failed');
    } finally {
      setSavingToggle(false);
    }
  };

  const archive = async (c) => {
    if (!window.confirm(`Archive "${c.name}"? It stops accepting enrolments and is hidden from the public landing page. Existing enrollments are preserved.`)) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/cohort-programs/${c.id}`, { withCredentials: true });
      toast.success('Cohort archived');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Archive failed');
    }
  };

  const hardDelete = async (c) => {
    const enrolled = c.enrollment_count || 0;
    if (enrolled > 0) {
      toast.error(`Cannot delete: ${enrolled} enrolment(s) exist. Archive instead to preserve history.`);
      return;
    }
    const ok = window.confirm(
      `Permanently delete "${c.name}"?\n\n` +
      `This removes the cohort and all its sessions from the database. This action CANNOT be undone.\n\n` +
      `Type OK in the next dialog to confirm.`
    );
    if (!ok) return;
    const confirm2 = window.prompt(`To permanently delete "${c.name}", type its slug (${c.slug}) below:`);
    if ((confirm2 || '').trim() !== c.slug) {
      toast.error('Slug did not match — cancelled');
      return;
    }
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/cohort-programs/${c.id}?hard=true`, { withCredentials: true });
      toast.success('Cohort permanently deleted');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Delete failed');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;

  return (
    <div className="space-y-3">
      {/* Landing page toggle — controls Enrol button on the static
          /cohort landing whenever no admin-published cohort exists. */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4" data-testid="cohort-landing-toggle">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Public /cohort landing — accept enrolments</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            When ON, the "Enrol now" button on the public landing page is active and accepts payments. When OFF, it shows "Enrolments closed" and only the Discovery Call CTA stays active. Curriculum and pricing are always visible regardless.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            This toggle only applies when there's no published cohort below. If you publish a cohort with slug <code>case-interview-sprint</code>, that cohort's own Active flag takes over.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0" data-testid="cohort-landing-toggle-switch">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={acceptEnrolments}
            disabled={savingToggle}
            onChange={(e) => toggleAcceptEnrolments(e.target.checked)}
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-violet-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          <span className="ml-3 text-xs font-medium text-slate-700 w-12">
            {acceptEnrolments ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')} data-testid="cohort-admin-new-btn">
          <Plus className="w-4 h-4 mr-1" /> New cohort
        </Button>
      </div>
      {cohorts.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
          No cohorts yet. Click "New cohort" to launch your first one.
        </div>
      ) : (
        <div className="grid gap-3">
          {cohorts.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-4" data-testid={`cohort-admin-row-${c.slug}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                    {c.is_active ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded uppercase font-bold">Active</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase font-bold">Archived</span>
                    )}
                    {c.is_featured && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded uppercase font-bold">Featured</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">/cohort/{c.slug}</div>
                  {c.tagline && <p className="text-sm text-slate-600 mt-1">{c.tagline}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>₹{Number(c.price || 0).toLocaleString('en-IN')} + GST</span>
                    <span>·</span>
                    <span>{c.duration_weeks || 0} weeks</span>
                    <span>·</span>
                    <span>{(c.sessions || []).length} sessions</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {c.enrollment_count || 0} enrolled</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)} data-testid={`cohort-admin-edit-${c.slug}`} title="Edit">
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  {c.is_active && (
                    <Button size="sm" variant="outline" onClick={() => archive(c)} data-testid={`cohort-admin-archive-${c.slug}`} title="Archive (preserves enrolments)">
                      <Archive className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => hardDelete(c)}
                    data-testid={`cohort-admin-delete-${c.slug}`}
                    disabled={(c.enrollment_count || 0) > 0}
                    title={(c.enrollment_count || 0) > 0
                      ? `Cannot delete — ${c.enrollment_count} enrolment(s) exist. Archive instead.`
                      : 'Permanently delete this cohort'}
                    className={(c.enrollment_count || 0) > 0
                      ? 'opacity-40 cursor-not-allowed'
                      : 'text-rose-700 border-rose-300 hover:bg-rose-50 hover:text-rose-800'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CohortEditor
          cohort={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {pastMentorsFor && (
        <CohortPastMentorsModal
          cohort={pastMentorsFor}
          onClose={() => setPastMentorsFor(null)}
          onSaved={() => { setPastMentorsFor(null); }}
        />
      )}
    </div>
  );
}


/* ============= Cohort editor modal ============= */

const blankCohort = () => ({
  name: '',
  slug: '',
  tagline: '',
  description: '',
  duration_weeks: 4,
  price: 25000,
  plan_key: 'cohort_premium',
  start_date: '',
  end_date: '',
  is_active: true,
  is_featured: true,
  seats_total: null,
  cover_image_url: '',
  highlights: [],
  sessions: [],
  plans: [],
});

function CohortEditor({ cohort, onClose, onSaved }) {
  const isNew = !cohort;
  const [form, setForm] = useState(() => ({
    ...blankCohort(),
    ...(cohort || {}),
    highlights: cohort?.highlights || [],
    sessions: (cohort?.sessions || []).sort((a, b) => (a.week_number || 0) - (b.week_number || 0)),
    plans: cohort?.plans || [],
  }));
  const [saving, setSaving] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const addSession = () => {
    upd('sessions', [
      ...(form.sessions || []),
      { week_number: 1, day_label: 'Saturday', topic: '', session_type: 'Live Session', time_slot: '6:00 PM - 8:00 PM', duration_minutes: 120 },
    ]);
  };
  const updSession = (idx, k, v) => {
    const next = [...form.sessions];
    next[idx] = { ...next[idx], [k]: v };
    upd('sessions', next);
  };
  const removeSession = (idx) => {
    upd('sessions', form.sessions.filter((_, i) => i !== idx));
  };

  // Plans CRUD — landing page pricing tiers
  const addPlan = () => {
    upd('plans', [
      ...(form.plans || []),
      { name: 'New Plan', price: '₹25,000', cadence: 'one-time', blurb: '', features: [''], cta: 'Apply', highlight: false, badge: '' },
    ]);
  };
  const updPlan = (idx, k, v) => {
    const next = [...(form.plans || [])];
    next[idx] = { ...next[idx], [k]: v };
    upd('plans', next);
  };
  const removePlan = (idx) => {
    upd('plans', (form.plans || []).filter((_, i) => i !== idx));
  };
  const updPlanFeature = (planIdx, featIdx, value) => {
    const next = [...(form.plans || [])];
    const feats = [...(next[planIdx].features || [])];
    feats[featIdx] = value;
    next[planIdx] = { ...next[planIdx], features: feats };
    upd('plans', next);
  };
  const addPlanFeature = (planIdx) => {
    const next = [...(form.plans || [])];
    next[planIdx] = { ...next[planIdx], features: [...(next[planIdx].features || []), ''] };
    upd('plans', next);
  };
  const removePlanFeature = (planIdx, featIdx) => {
    const next = [...(form.plans || [])];
    next[planIdx] = {
      ...next[planIdx],
      features: (next[planIdx].features || []).filter((_, i) => i !== featIdx),
    };
    upd('plans', next);
  };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Name is required'); return; }
    if (!form.slug?.trim()) { toast.error('Slug is required'); return; }
    if (!Number(form.price) || Number(form.price) <= 0) { toast.error('Price must be > 0'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        duration_weeks: Number(form.duration_weeks) || 4,
        seats_total: form.seats_total ? Number(form.seats_total) : null,
        sessions: (form.sessions || []).map((s) => ({
          ...s,
          week_number: Number(s.week_number) || 1,
          duration_minutes: Number(s.duration_minutes) || 120,
        })),
      };
      if (isNew) {
        await axios.post(`${BACKEND_URL}/api/admin/cohort-programs`, payload, { withCredentials: true });
        toast.success('Cohort created');
      } else {
        await axios.put(`${BACKEND_URL}/api/admin/cohort-programs/${cohort.id}`, payload, { withCredentials: true });
        toast.success('Cohort updated');
      }
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose} data-testid="cohort-admin-editor">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-base font-semibold">{isNew ? 'New Cohort' : `Edit: ${form.name}`}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <input
                value={form.name}
                onChange={(e) => { upd('name', e.target.value); if (!form.slug) upd('slug', slugify(e.target.value)); }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                data-testid="cohort-form-name"
              />
            </Field>
            <Field label="Slug * (URL)">
              <input
                value={form.slug}
                onChange={(e) => upd('slug', slugify(e.target.value))}
                placeholder="case-interview-sprint"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                data-testid="cohort-form-slug"
              />
            </Field>
          </div>
          <Field label="Tagline (one-line)">
            <input
              value={form.tagline || ''}
              onChange={(e) => upd('tagline', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={3}
              value={form.description || ''}
              onChange={(e) => upd('description', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Price (INR, ex-GST)">
              <input
                type="number"
                value={form.price}
                onChange={(e) => upd('price', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                data-testid="cohort-form-price"
              />
            </Field>
            <Field label="Duration (weeks)">
              <input
                type="number"
                value={form.duration_weeks}
                onChange={(e) => upd('duration_weeks', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </Field>
            <Field label="Plan key">
              <input
                value={form.plan_key}
                onChange={(e) => upd('plan_key', e.target.value)}
                placeholder="cohort_premium"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start date (admin only)">
              <input type="date" value={form.start_date || ''} onChange={(e) => upd('start_date', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </Field>
            <Field label="End date (admin only)">
              <input type="date" value={form.end_date || ''} onChange={(e) => upd('end_date', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </Field>
            <Field label="Total seats (optional)">
              <input
                type="number"
                value={form.seats_total ?? ''}
                onChange={(e) => upd('seats_total', e.target.value || null)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </Field>
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_active} onChange={(e) => upd('is_active', e.target.checked)} /> Active (open for enrolment)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_featured} onChange={(e) => upd('is_featured', e.target.checked)} /> Featured (show on landing page)</label>
          </div>

          <Field label="Highlights (one per line)">
            <textarea
              rows={4}
              value={(form.highlights || []).join('\n')}
              onChange={(e) => upd('highlights', e.target.value.split('\n').filter((l) => l.trim()))}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              placeholder="8 live sessions over 4 weekends&#10;Live cases by ex-MBB consultants&#10;Cohort community + accountability"
            />
          </Field>

          {/* Sessions editor */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-800">Curriculum / Sessions</h4>
              <Button size="sm" variant="outline" onClick={addSession}><Plus className="w-3.5 h-3.5 mr-1" /> Add session</Button>
            </div>
            {(form.sessions || []).length === 0 && (
              <p className="text-xs text-slate-500">No sessions yet. Click "Add session".</p>
            )}
            <div className="space-y-2">
              {(form.sessions || []).map((s, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start p-2 bg-slate-50 border border-slate-200 rounded" data-testid={`cohort-form-session-${idx}`}>
                  <div className="col-span-1">
                    <label className="text-[10px] text-slate-500">Wk</label>
                    <input type="number" value={s.week_number} onChange={(e) => updSession(idx, 'week_number', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500">Day</label>
                    <select value={s.day_label || ''} onChange={(e) => updSession(idx, 'day_label', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs">
                      <option value="">—</option>
                      <option>Monday</option>
                      <option>Tuesday</option>
                      <option>Wednesday</option>
                      <option>Thursday</option>
                      <option>Friday</option>
                      <option>Saturday</option>
                      <option>Sunday</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className="text-[10px] text-slate-500">Topic</label>
                    <input value={s.topic || ''} onChange={(e) => updSession(idx, 'topic', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500">Type</label>
                    <input value={s.session_type || ''} onChange={(e) => updSession(idx, 'session_type', e.target.value)} placeholder="Live Session" className="w-full px-2 py-1 border border-slate-300 rounded text-xs" data-testid={`cohort-form-session-type-${idx}`} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500">Date</label>
                    <input type="date" value={s.date || ''} onChange={(e) => updSession(idx, 'date', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] text-slate-500">Time</label>
                    <input value={s.time_slot || ''} onChange={(e) => updSession(idx, 'time_slot', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs" placeholder="6-8 PM" />
                  </div>
                  <div className="col-span-1 flex items-end h-full justify-end">
                    <button onClick={() => removeSession(idx)} className="text-rose-600 p-1 hover:bg-rose-50 rounded" data-testid={`cohort-form-session-remove-${idx}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="col-span-12">
                    <label className="text-[10px] text-slate-500">Meet link (optional, for enrolled students)</label>
                    <input value={s.meet_link || ''} onChange={(e) => updSession(idx, 'meet_link', e.target.value)} placeholder="https://meet.google.com/..." className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing plans note — managed via Plans Management */}
          <div className="pt-4 border-t border-slate-200">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <h4 className="text-sm font-semibold text-blue-900">Pricing plans → managed in <span className="underline">Plans Management</span></h4>
              <p className="mt-1 text-xs text-blue-800">
                Cohort pricing tiers (Cohort Premium, Cohort Elite, etc.) and their offerings (coaching sessions, strategy calls, peer practice, workshops, recordings, drills, materials) are now managed under
                {' '}<span className="font-medium">Admin → Plans</span> with category <span className="font-mono">cohort</span>. The cohort landing page automatically renders all active cohort plans there.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} data-testid="cohort-form-save-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
            {isNew ? 'Create cohort' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
    {children}
  </div>
);


/* ============= Enrollments tab ============= */

function EnrollmentsList() {
  const [cohorts, setCohorts] = useState([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/admin/cohort-programs`, { withCredentials: true })
      .then((r) => {
        setCohorts(r.data?.cohorts || []);
        if (r.data?.cohorts?.length) setSelectedCohort(r.data.cohorts[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedCohort) return;
    setLoading(true);
    axios.get(`${BACKEND_URL}/api/admin/cohort-programs/${selectedCohort}/enrollments`, { withCredentials: true })
      .then((r) => setEnrollments(r.data?.enrollments || []))
      .finally(() => setLoading(false));
  }, [selectedCohort]);

  return (
    <div className="space-y-3" data-testid="cohort-admin-enrollments">
      <select
        value={selectedCohort}
        onChange={(e) => setSelectedCohort(e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded text-sm"
        data-testid="cohort-admin-enrollments-select"
      >
        {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-violet-600" /> : enrollments.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded border border-slate-200">No enrollments yet.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Candidate</th>
                <th className="text-left px-4 py-2 font-semibold">Email</th>
                <th className="text-right px-4 py-2 font-semibold">Paid</th>
                <th className="text-left px-4 py-2 font-semibold">Coupon</th>
                <th className="text-left px-4 py-2 font-semibold">Enrolled at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enrollments.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{e.user?.name || e.user_name || '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.user?.email || e.user_email}</td>
                  <td className="px-4 py-2 text-right font-medium">₹{Number(e.amount_paid || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-xs">{e.coupon_code || '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{e.enrolled_at?.split('T')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* ============= Discovery calls tab ============= */

function DiscoveryCallsList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [scheduling, setScheduling] = useState(null); // request id

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${BACKEND_URL}/api/admin/cohort-programs/discovery-calls/list`, { withCredentials: true });
      setRequests(r.data?.requests || []);
    } catch (e) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const action = async (id, kind, payload = null) => {
    try {
      const url = `${BACKEND_URL}/api/admin/cohort-programs/discovery-calls/${id}/${kind}`;
      await axios.post(url, payload || {}, { withCredentials: true });
      toast.success(kind === 'schedule' ? 'Scheduled' : kind === 'mark-completed' ? 'Marked completed' : 'Cancelled');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Action failed');
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const counts = requests.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;

  return (
    <div className="space-y-3" data-testid="cohort-admin-discovery-calls">
      <div className="flex items-center gap-1 text-xs">
        {['all', 'pending', 'scheduled', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded font-medium ${filter === s ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            data-testid={`cohort-discovery-filter-${s}`}
          >
            {s} {s !== 'all' && counts[s] ? `(${counts[s]})` : ''}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded border border-slate-200">No requests in this filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <div key={req.id} className="bg-white border border-slate-200 rounded-lg p-4" data-testid={`cohort-discovery-row-${req.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900">{req.name}</h4>
                    <StatusPill status={req.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{req.email} {req.phone ? `· ${req.phone}` : ''}</div>
                  {req.cohort_name && <div className="text-xs text-slate-700 mt-1">Interested in: <span className="font-medium">{req.cohort_name}</span></div>}
                  {req.preferred_time && <div className="text-xs text-slate-500 mt-1"><span className="font-medium">Preferred time:</span> {req.preferred_time}</div>}
                  {req.message && <div className="mt-2 text-sm text-slate-700 italic bg-slate-50 px-3 py-2 rounded">"{req.message}"</div>}
                  {req.scheduled_at && <div className="text-xs text-emerald-700 mt-2">📅 Scheduled for {new Date(req.scheduled_at).toLocaleString('en-IN')}</div>}
                  <div className="text-[10px] text-slate-400 mt-2">Requested {new Date(req.requested_at).toLocaleString('en-IN')}</div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {req.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => setScheduling(req.id)} data-testid={`cohort-discovery-schedule-${req.id}`}>
                      <Calendar className="w-3.5 h-3.5 mr-1" /> Schedule
                    </Button>
                  )}
                  {req.status === 'scheduled' && (
                    <Button size="sm" variant="outline" onClick={() => action(req.id, 'mark-completed')}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark completed
                    </Button>
                  )}
                  {req.status !== 'cancelled' && req.status !== 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => action(req.id, 'cancel')} className="text-rose-700">
                      <X className="w-3.5 h-3.5 mr-1" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {scheduling && (
        <ScheduleModal
          requestId={scheduling}
          onClose={() => setScheduling(null)}
          onSaved={() => { setScheduling(null); load(); }}
        />
      )}
    </div>
  );
}

const StatusPill = ({ status }) => {
  const map = {
    pending: 'bg-amber-100 text-amber-800',
    scheduled: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-slate-100 text-slate-500',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${map[status] || map.pending}`}>{status}</span>;
};

function ScheduleModal({ requestId, onClose, onSaved }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!scheduledAt) { toast.error('Pick a date & time'); return; }
    setSaving(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/cohort-programs/discovery-calls/${requestId}/schedule`,
        { scheduled_at: new Date(scheduledAt).toISOString(), meet_link: meetLink || null, notes: notes || null },
        { withCredentials: true },
      );
      toast.success('Scheduled');
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Schedule failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold">Schedule discovery call</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Date & time *">
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" data-testid="cohort-discovery-schedule-time" />
          </Field>
          <Field label="Meet link (optional)">
            <input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" placeholder="https://meet.google.com/..." />
          </Field>
          <Field label="Notes (optional)">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} data-testid="cohort-discovery-schedule-confirm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Schedule'}</Button>
        </div>
      </div>
    </div>
  );
}


export default CohortProgramsAdmin;
