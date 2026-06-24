'use client';

import { FileText, Download } from 'lucide-react';

export interface DocumentItem {
  id: string;
  title: string | null;
  category: string;
  storage_path: string;
  created_at: string;
}

/**
 * Renders documents for any entity (unit, contract, ticket, project…).
 * Download links resolve to signed URLs generated server-side
 * (see lib/storage.ts) — never a public bucket path.
 */
export function DocumentList({
  documents,
  getSignedUrl,
}: {
  documents: DocumentItem[];
  getSignedUrl: (path: string) => Promise<string>;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-charcoal-600/70">No documents uploaded yet.</p>;
  }

  return (
    <ul className="divide-y divide-stone-line">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-olive" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-medium text-charcoal">{doc.title ?? 'Untitled document'}</p>
              <p className="badge-neutral mt-0.5">{doc.category.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              const url = await getSignedUrl(doc.storage_path);
              window.open(url, '_blank');
            }}
            className="btn-ghost"
          >
            <Download size={14} strokeWidth={1.75} /> Download
          </button>
        </li>
      ))}
    </ul>
  );
}
