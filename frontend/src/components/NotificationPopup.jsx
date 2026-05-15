import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Bell, AlertCircle, CheckCircle2, Loader2, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const formatDeadline = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
};

const NotificationPopup = ({ audience = 'candidate' }) => {
  const [notif, setNotif] = useState(null);
  const [open, setOpen] = useState(false);
  const [responseData, setResponseData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const recordedRef = useRef(false);

  const baseUrl = audience === 'mentor'
    ? `${BACKEND_URL}/api/mentor-dashboard/notifications`
    : `${BACKEND_URL}/api/candidate/notifications`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${baseUrl}/active-popup`, { withCredentials: true });
        const n = res.data?.notification;
        if (cancelled || !n) return;
        setNotif(n);
        setOpen(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug('[NotificationPopup] fetch failed:', err?.response?.status || err?.message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  useEffect(() => {
    if (!open || !notif?.id || recordedRef.current) return;
    recordedRef.current = true;
    axios.post(`${baseUrl}/${notif.id}/popup-shown`, {}, { withCredentials: true })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.debug('[NotificationPopup] record-shown failed:', err?.response?.status || err?.message);
      });
  }, [open, notif, baseUrl]);

  const isResponseRequired = notif?.type === 'response_required';
  const formFields = notif?.form_fields || [];
  const isDeadlinePassed = notif?.deadline && new Date(notif.deadline) < new Date();
  const showForm = isResponseRequired && !submitted && !isDeadlinePassed && formFields.length > 0;

  const handleSubmit = async () => {
    if (!notif) return;
    const missing = formFields.find((f) => {
      if (!f.required) return false;
      const v = responseData[f.name];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === '';
    });
    if (missing) {
      setSubmitError(`Please fill in: ${missing.label || missing.name}`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await axios.post(
        `${baseUrl}/${notif.id}/respond`,
        { response_data: responseData },
        { withCredentials: true }
      );
      setSubmitted(true);
      setTimeout(() => setOpen(false), 1100);
    } catch (err) {
      setSubmitError(err?.response?.data?.detail || err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const value = responseData[field.name] ?? (field.type === 'checkbox' ? [] : '');
    const setVal = (v) => setResponseData((prev) => ({ ...prev, [field.name]: v }));
    const testId = `notification-popup-field-${field.name}`;

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            data-testid={testId}
            value={value}
            rows={3}
            onChange={(e) => setVal(e.target.value)}
            placeholder={`Your ${(field.label || '').toLowerCase()}`}
            className="resize-none"
          />
        );
      case 'number':
        return (
          <Input
            data-testid={testId}
            type="number"
            value={value}
            onChange={(e) => setVal(e.target.value)}
          />
        );
      case 'date':
        return (
          <Input
            data-testid={testId}
            type="date"
            value={value}
            onChange={(e) => setVal(e.target.value)}
          />
        );
      case 'select':
        return (
          <Select value={value} onValueChange={setVal}>
            <SelectTrigger data-testid={testId}>
              <SelectValue placeholder={`Select ${(field.label || '').toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'scale': {
        const options = field.options || [];
        return (
          <div className="space-y-1.5" data-testid={testId}>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {options.map((opt) => {
                const selected = String(value) === String(opt);
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setVal(opt)}
                    role="radio"
                    aria-checked={selected}
                    data-testid={`${testId}-option-${opt}`}
                    className={`min-w-[2.5rem] h-10 px-3 rounded-full border text-sm font-semibold transition-all ${
                      selected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {options.length > 0 && (
              <div className="flex justify-between text-[11px] text-slate-500 px-1">
                <span>Low (1)</span>
                <span>High ({options[options.length - 1]})</span>
              </div>
            )}
          </div>
        );
      }
      case 'radio': {
        const options = field.options || [];
        // Compact pill layout for short options (e.g. numeric ratings, Yes/No)
        const isCompact = options.length <= 12 && options.every((o) => (o || '').length <= 4);
        if (isCompact) {
          return (
            <div className="flex flex-wrap gap-2" data-testid={testId} role="radiogroup">
              {options.map((opt) => {
                const selected = value === opt;
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setVal(opt)}
                    role="radio"
                    aria-checked={selected}
                    data-testid={`${testId}-option-${opt}`}
                    className={`min-w-[2.75rem] h-10 px-3 rounded-full border text-sm font-medium transition-all ${
                      selected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <div className="space-y-2" data-testid={testId}>
            {options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`${notif.id}-${field.name}`}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => setVal(e.target.value)}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-slate-700">{opt}</span>
              </label>
            ))}
          </div>
        );
      }
      case 'checkbox': {
        const arr = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2" data-testid={testId}>
            {(field.options || []).map((opt) => {
              const checked = arr.includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      if (c) setVal([...arr, opt]);
                      else setVal(arr.filter((v) => v !== opt));
                    }}
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              );
            })}
          </div>
        );
      }
      case 'text':
      default:
        return (
          <Input
            data-testid={testId}
            type="text"
            value={value}
            onChange={(e) => setVal(e.target.value)}
            placeholder={`Your ${(field.label || '').toLowerCase()}`}
          />
        );
    }
  };

  if (!notif) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <DialogContent
        className="max-w-md max-h-[88vh] overflow-y-auto p-0 gap-0 border border-slate-200 rounded-2xl shadow-2xl"
        data-testid="notification-popup"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-br from-blue-50/60 to-white rounded-t-2xl">
          <DialogHeader className="text-left">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl shrink-0">
                <Bell className="w-5 h-5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                {isResponseRequired && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-orange-100 text-orange-700">
                    Response required
                  </div>
                )}
                <DialogTitle
                  className="text-base font-semibold text-slate-900 leading-snug"
                  data-testid="notification-popup-title"
                >
                  {notif.title}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p
            className="text-sm text-slate-600 whitespace-pre-line leading-relaxed"
            data-testid="notification-popup-message"
          >
            {notif.message}
          </p>

          {notif.deadline && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                isDeadlinePassed
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isDeadlinePassed ? 'Deadline passed: ' : 'Respond by '}
                {formatDeadline(notif.deadline)}
              </span>
            </div>
          )}

          {showForm && (
            <div className="space-y-4 pt-1">
              {formFields.map((field) => (
                <div key={field.name}>
                  <Label className="text-sm font-medium text-slate-800 mb-2 block">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  {renderField(field)}
                </div>
              ))}

              {submitError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {submitted && (
            <div className="flex items-center gap-2 px-3 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">Response submitted. Thank you!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 rounded-b-2xl flex justify-end gap-2">
          {showForm ? (
            <>
              <Button
                data-testid="notification-popup-close-btn"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="text-slate-600 hover:text-slate-900"
              >
                Maybe later
              </Button>
              <Button
                data-testid="notification-popup-submit-btn"
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 min-w-[7.5rem]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit response'
                )}
              </Button>
            </>
          ) : (
            <Button
              data-testid="notification-popup-close-btn"
              onClick={() => setOpen(false)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitted ? 'Done' : 'Close'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationPopup;
