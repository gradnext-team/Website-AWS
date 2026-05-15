import React, { useState, useRef } from 'react';
import axios from 'axios';
import { FileSpreadsheet, Upload, RefreshCw, ChevronRight } from 'lucide-react';
import { BACKEND_URL } from '../crmApi';

const ImportSection = ({ fetchLeads }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const fileRef = useRef();

  const handleImport = async () => {
    if (!file) return;
    try {
      setImporting(true);
      setResult(null);
      const formData = new FormData();
      formData.append('file', file);
      // Use axios directly with explicit withCredentials, matching admin dashboard pattern
      const res = await axios.post(
        `${BACKEND_URL}/api/crm/leads/import-csv`,
        formData,
        { withCredentials: true }
      );
      setResult(res.data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setResult({ error: err.response?.data?.detail || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const handleSync = async (type) => {
    try {
      setSyncing(true);
      setSyncResult(null);
      const res = await axios.post(
        `${BACKEND_URL}/api/crm/sync/${type}`,
        {},
        { withCredentials: true }
      );
      setSyncResult({ type, ...res.data });
    } catch (err) {
      setSyncResult({ error: err.response?.data?.detail || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">Import & Sync</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Import */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">CSV Import</h3>
              <p className="text-xs text-slate-500">Upload a CSV file with leads data</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={e => setFile(e.target.files[0])} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">{file ? file.name : 'Click to upload CSV / TSV'}</p>
                <p className="text-xs text-slate-400 mt-1">Supported columns: Name, Email, Phone, Company, First Call Date, Call Status, Lead Status, POC, Plan Purchased, Amount, and more</p>
              </label>
            </div>
            <button onClick={handleImport} disabled={!file || importing}
              className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {importing ? 'Importing...' : 'Import Leads'}
            </button>
            {result && (
              <div className={`p-3 rounded-lg text-sm ${result.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {result.error || result.message}
                {result.contacted > 0 && (
                  <p className="text-xs mt-1 text-blue-600 font-medium">{result.contacted} lead(s) marked as contacted (had First Call Date)</p>
                )}
                {result.columns_found && (
                  <p className="text-xs mt-1 text-slate-500">Columns detected: {result.columns_found.join(', ')}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sync from Existing Data */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Sync Existing Data</h3>
              <p className="text-xs text-slate-500">Import leads from your existing systems</p>
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={() => handleSync('discovery-calls')} disabled={syncing}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors">
              <div>
                <p className="text-sm font-medium text-slate-700">Discovery Call Bookings</p>
                <p className="text-xs text-slate-400">Import from coaching & cohort discovery calls</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={() => handleSync('free-signups')} disabled={syncing}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors">
              <div>
                <p className="text-sm font-medium text-slate-700">Free Trial Signups</p>
                <p className="text-xs text-slate-400">Import free trial users as leads</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            {syncing && (
              <div className="flex items-center justify-center py-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent mr-2" />
                <span className="text-sm text-slate-500">Syncing...</span>
              </div>
            )}
            {syncResult && (
              <div className={`p-3 rounded-lg text-sm ${syncResult.error ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                {syncResult.error || syncResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { ImportSection };
