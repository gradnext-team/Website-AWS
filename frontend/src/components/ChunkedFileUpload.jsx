import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Upload, X, CheckCircle2, AlertCircle, FileVideo, FileText, Image, File, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Chunk size: 10MB. Larger chunks = fewer round trips (HTTP/auth overhead
// is fixed per request, ~50-200ms each), which dramatically speeds up
// uploads on fast connections. Still well below typical proxy/CDN body
// limits (Cloudflare 100MB, nginx defaults).
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

// Retry transient gateway / server errors (5xx, 408, 429, network blips).
// Cloudflare returns 520-526 when the origin connection misbehaves – treat
// those as transient and retry instead of failing the whole upload.
const isRetriableHttpStatus = (status) => {
  if (!status) return true; // network error / no response
  if (status >= 500 && status < 600) return true;
  return status === 408 || status === 429;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Generic retry wrapper for upload sub-requests
const postWithRetry = async (url, body, axiosOpts = {}, attempts = 4) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await axios.post(url, body, axiosOpts);
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // Don't retry on auth, validation, or explicit client errors
      if (status && !isRetriableHttpStatus(status)) throw err;
      if (attempt === attempts) throw err;
      const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s
      // eslint-disable-next-line no-console
      console.warn(`[ChunkedFileUpload] Request failed (attempt ${attempt}/${attempts}, status=${status || 'network'}). Retrying in ${delayMs}ms…`);
      await sleep(delayMs);
    }
  }
  throw lastError;
};

// File type icons
const getFileIcon = (mimeType) => {
  if (mimeType?.startsWith('video/')) return FileVideo;
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
  return File;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * ChunkedFileUpload - Supports large file uploads (2GB+) via chunked transfer
 * Falls back to regular upload for small files
 */
export const ChunkedFileUpload = ({
  onUpload,
  category = 'general',
  accept = '*',
  label = 'Upload File',
  maxSize = 2 * 1024 * 1024 * 1024, // 2GB default
  showPreview = true,
  persistToDb = false, // Set to true for images that need to persist across deployments
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState(''); // 'preparing', 'uploading', 'finalizing'
  const [error, setError] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setUploadedUrl(null);

    // Check file size
    if (file.size > maxSize) {
      setError(`File size exceeds maximum allowed (${formatFileSize(maxSize)})`);
      return;
    }

    setSelectedFile(file);
  };

  const uploadSmallFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    
    // For images that need to persist across deployments, store in MongoDB
    if (persistToDb) {
      formData.append('persist_to_db', 'true');
    }

    const response = await postWithRetry(
      `${BACKEND_URL}/api/admin/upload`,
      formData,
      {
        withCredentials: true,
        // DO NOT manually set Content-Type for FormData - axios auto-sets it with correct boundary
        onUploadProgress: (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(pct);
        },
        signal: abortControllerRef.current.signal,
        timeout: 120000,
      }
    );

    return response.data.url;
  };

  const uploadChunked = async (file) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileName = file.name;
    const fileType = file.type;

    // Phase 1: Initialize upload (with retry for transient errors)
    setUploadPhase('preparing');
    const initResponse = await postWithRetry(
      `${BACKEND_URL}/api/admin/upload/init`,
      {
        filename: fileName,
        filesize: file.size,
        filetype: fileType,
        total_chunks: totalChunks,
        upload_id: uploadId,
        category: category,
      },
      { withCredentials: true, timeout: 30000 }
    );

    if (!initResponse.data.success) {
      throw new Error(initResponse.data.error || 'Failed to initialize upload');
    }

    // Phase 2: Upload chunks. We dispatch up to MAX_CONCURRENT chunks in
    // parallel against a shared worker pool — vastly faster than one-at-a-
    // time over the browser's HTTP/1.1 connection pool. Progress updates as
    // each chunk completes (regardless of order).
    setUploadPhase('uploading');
    const MAX_CONCURRENT = 5;
    let nextChunkIndex = 0;
    let completedChunks = 0;
    let firstError = null;

    const worker = async () => {
      while (true) {
        if (firstError) return;
        if (abortControllerRef.current?.signal.aborted) return;
        const myIndex = nextChunkIndex++;
        if (myIndex >= totalChunks) return;

        const start = myIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('upload_id', uploadId);
        formData.append('chunk_index', myIndex);
        formData.append('total_chunks', totalChunks);

        try {
          await postWithRetry(
            `${BACKEND_URL}/api/admin/upload/chunk`,
            formData,
            {
              withCredentials: true,
              // DO NOT manually set Content-Type for FormData - axios auto-sets it with correct boundary
              signal: abortControllerRef.current.signal,
              timeout: 60000,
            }
          );
          completedChunks++;
          setProgress(Math.round((completedChunks / totalChunks) * 100));
        } catch (err) {
          if (!firstError) firstError = err;
          return;
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(MAX_CONCURRENT, totalChunks); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    if (firstError) {
      throw firstError;
    }

    // Phase 3: Finalize upload (with retry for transient gateway errors).
    //
    // The backend now returns IMMEDIATELY with { status: "processing" }
    // and does the heavy combine + cloud-upload work asynchronously. This
    // dodges Cloudflare's 100s response timeout (which previously caused
    // 520 errors on large files like 1.5GB workshop videos). We then poll
    // the status endpoint until the upload completes server-side.
    setUploadPhase('finalizing');
    const finalizeResponse = await postWithRetry(
      `${BACKEND_URL}/api/admin/upload/finalize`,
      {
        upload_id: uploadId,
        filename: fileName,
        total_chunks: totalChunks,
        category: category,
      },
      {
        withCredentials: true,
        timeout: 60000, // finalize now returns in <1s; 60s is plenty
      }
    );

    if (!finalizeResponse.data.success) {
      throw new Error(finalizeResponse.data.error || 'Failed to finalize upload');
    }

    // If the backend processed inline and returned the URL directly
    // (legacy path / very small uploads), we're done.
    if (finalizeResponse.data.url && finalizeResponse.data.status !== 'processing') {
      return finalizeResponse.data.url;
    }

    // Otherwise poll the status endpoint until the server reports `done`
    // or `failed`. We start polling fast and back off — small uploads
    // typically finish in 1-3s, large uploads (1GB+) can take a few
    // minutes for the backend → cloud-storage push.
    setUploadPhase('processing');
    setProgress(100);
    const POLL_INTERVAL_MS = 2500;
    const POLL_MAX_ATTEMPTS = 480; // ~20 min ceiling for very large videos
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }
      await sleep(POLL_INTERVAL_MS);
      try {
        const statusRes = await axios.get(
          `${BACKEND_URL}/api/admin/upload/status/${uploadId}`,
          { withCredentials: true, timeout: 15000 }
        );
        const s = statusRes.data || {};
        if (s.state === 'done' && s.url) {
          return s.url;
        }
        if (s.state === 'failed') {
          throw new Error(s.error || 'Server-side upload processing failed');
        }
        // still processing — keep going
      } catch (err) {
        // 404 right after finalize can briefly happen if the status file
        // hasn't been written yet — be tolerant for the first few polls.
        const status = err.response?.status;
        if (status === 404 && attempt < 4) continue;
        // For other transient errors, swallow and retry
        if (!status || isRetriableHttpStatus(status)) continue;
        throw err;
      }
    }
    throw new Error('Upload timed out while waiting for server-side processing');
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    abortControllerRef.current = new AbortController();

    // Pause PostHog session recording during the upload window. Session
    // recording captures DOM mutations and during chunk progress updates
    // emits thousands of events, fights for the 6-connection HTTP/1.1 pool,
    // and noticeably slows uploads on poor links.
    try {
      if (window.posthog && typeof window.posthog.stopSessionRecording === 'function') {
        window.posthog.stopSessionRecording();
      }
    } catch (e) { /* ignore */ }

    try {
      let url;
      
      // ALWAYS use chunked upload for reliability.
      // Even small files benefit from chunked upload because:
      // 1. Each request is small (1MB) - works with any proxy/CDN limit
      // 2. Failed chunks can be retried individually
      // 3. Progress tracking is more accurate
      // Only exception: tiny files under 512KB use simple upload for speed
      const isSmallNonVideo = selectedFile.size < 512 * 1024 && 
        !selectedFile.type?.startsWith('video/') &&
        !/\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v|mpeg|mpg)$/i.test(selectedFile.name);
      
      if (isSmallNonVideo) {
        setUploadPhase('uploading');
        url = await uploadSmallFile(selectedFile);
      } else {
        url = await uploadChunked(selectedFile);
      }

      setUploadedUrl(url);
      setUploadPhase('');
      onUpload(url, selectedFile.name);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        setError('Upload cancelled');
      } else {
        setError(err.response?.data?.detail || err.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadPhase('');
      // Resume session recording so the rest of the user's admin work is captured.
      try {
        if (window.posthog && typeof window.posthog.startSessionRecording === 'function') {
          window.posthog.startSessionRecording();
        }
      } catch (e) { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, category, onUpload]);

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    setProgress(0);
    setUploadPhase('');
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setUploadedUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const FileIcon = selectedFile ? getFileIcon(selectedFile.type) : File;

  return (
    <div className="space-y-3" data-testid="chunked-file-upload">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={accept}
        className="hidden"
        data-testid="file-input"
      />

      {!selectedFile && !uploadedUrl && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
          data-testid="upload-dropzone"
        >
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-500 mt-1">
            Supports files up to {formatFileSize(maxSize)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Click to browse or drag and drop
          </p>
        </div>
      )}

      {selectedFile && !uploadedUrl && (
        <div className="border border-slate-200 rounded-xl p-4 bg-white">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <FileIcon className="w-6 h-6 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate">{selectedFile.name}</p>
              <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
              
              {uploading && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-600 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {uploadPhase === 'preparing' && 'Preparing...'}
                      {uploadPhase === 'uploading' && 'Uploading...'}
                      {uploadPhase === 'finalizing' && 'Finalizing...'}
                      {uploadPhase === 'processing' && 'Processing on server (large files can take a few minutes)…'}
                    </span>
                    <span className="text-slate-600 font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
            
            {!uploading && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                data-testid="clear-file-btn"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {error && (
            <div className="mt-3 p-2 bg-red-50 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {!uploading ? (
              <>
                <Button
                  type="button"
                  onClick={handleUpload}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="upload-btn"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="change-file-btn"
                >
                  Change
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={cancelUpload}
                className="flex-1"
                data-testid="cancel-upload-btn"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {uploadedUrl && (
        <div className="border border-green-200 rounded-xl p-4 bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-900">Upload Complete</p>
              <p className="text-sm text-green-700 truncate">{selectedFile?.name}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearSelection}
              className="border-green-300 text-green-700 hover:bg-green-100"
              data-testid="upload-another-btn"
            >
              Upload Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SimpleFileUpload - A simpler version for smaller files without chunked upload
 */
export const SimpleFileUpload = ({
  onUpload,
  category = 'general',
  accept = '*',
  label = 'Upload File',
  persistToDb = false, // Set to true for images that need to persist across deployments
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('persist_to_db', persistToDb ? 'true' : 'false');

    try {
      const res = await postWithRetry(
        `${BACKEND_URL}/api/admin/upload`,
        formData,
        {
          withCredentials: true,
          // DO NOT manually set Content-Type for FormData - axios auto-sets it with correct boundary
          onUploadProgress: (progressEvent) => {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(pct);
          },
          timeout: 120000,
        }
      );
      onUpload(res.data.url, file.name);
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={accept}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading {progress}%
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            {label}
          </>
        )}
      </Button>
      {uploading && (
        <Progress value={progress} className="h-2" />
      )}
    </div>
  );
};

export default ChunkedFileUpload;
