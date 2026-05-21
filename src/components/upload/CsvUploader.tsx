import { useRef, useState, useCallback } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { Button } from '../shared/Button';
import { formatDistanceToNow } from 'date-fns';

interface CsvUploaderProps {
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
  hasData: boolean;
  filename: string;
  uploadedAt: Date | null;
  error: string | null;
  warnings: string[];
}

export function CsvUploader({
  onUpload,
  onClear,
  hasData,
  filename,
  uploadedAt,
  error,
  warnings,
}: CsvUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.match(/\.(csv|tsv|txt)$/i)) {
        return;
      }
      onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (hasData) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 bg-surface-0 border border-surface-200 rounded-lg px-4 py-3">
          <FileText size={18} className="text-brand-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-brand-900 truncate">{filename}</p>
            {uploadedAt && (
              <p className="text-xs text-slate-400">
                Updated {formatDistanceToNow(uploadedAt, { addSuffix: true })}
              </p>
            )}
          </div>
          <Button variant="secondary" onClick={() => inputRef.current?.click()} className="text-xs px-3 py-1.5">
            <Upload size={14} />
            Replace
          </Button>
          <button onClick={onClear} className="text-slate-400 hover:text-status-red transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-status-red shrink-0 mt-0.5" />
            <p className="text-sm text-status-red">{error}</p>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-status-yellow mb-1">{warnings.length} warning(s):</p>
            {warnings.slice(0, 3).map((w, i) => (
              <p key={i} className="text-xs text-status-yellow">{w}</p>
            ))}
            {warnings.length > 3 && (
              <p className="text-xs text-status-yellow mt-1">...and {warnings.length - 3} more</p>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-[var(--radius-card)] p-12 text-center transition-colors ${
        dragging ? 'border-brand-500 bg-brand-50' : 'border-surface-200 bg-surface-0'
      }`}
    >
      <Upload size={40} className="mx-auto text-slate-300 mb-4" />
      <p className="text-lg font-semibold text-brand-900 mb-1">Upload your FBA shipping queue</p>
      <p className="text-sm text-slate-400 mb-6">
        Export the CSV from Amazon Seller Central and drop it here
      </p>
      <Button onClick={() => inputRef.current?.click()}>
        <Upload size={16} />
        Choose CSV File
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-6 text-left">
          <AlertCircle size={16} className="text-status-red shrink-0 mt-0.5" />
          <p className="text-sm text-status-red">{error}</p>
        </div>
      )}
    </div>
  );
}
