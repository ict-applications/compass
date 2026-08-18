import { useState, DragEvent, ChangeEvent, useRef } from 'react';

interface Props {
  onFile: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  currentFile?: File | null;
}

export default function FileDropzone({
  onFile,
  accept = '.pdf,.docx,.pptx',
  maxSizeMB = 10,
  label = 'Drop your file here or click to browse',
  currentFile,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'pptx', 'doc'].includes(ext ?? '')) {
      return 'Only PDF, DOCX, and PPTX files are accepted.';
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File must be under ${maxSizeMB}MB.`;
    }
    return null;
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onFile(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150
          ${dragging
            ? 'border-[#BFF143] bg-[#BFF143]/10'
            : currentFile
            ? 'border-green-400 bg-green-50'
            : 'border-slate-300 hover:border-slate-400 bg-white'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleChange}
        />
        <div className="text-4xl mb-3">
          {currentFile ? '✅' : dragging ? '📂' : '📄'}
        </div>
        {currentFile ? (
          <div>
            <p className="text-green-700 font-medium">{currentFile.name}</p>
            <p className="text-slate-600 text-sm mt-1">
              {(currentFile.size / 1024 / 1024).toFixed(2)} MB — Click to change
            </p>
          </div>
        ) : (
          <div>
            <p className="text-slate-700 font-medium">{label}</p>
            <p className="text-slate-500 text-sm mt-1">PDF, DOCX, PPTX — max {maxSizeMB}MB</p>
          </div>
        )}
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
