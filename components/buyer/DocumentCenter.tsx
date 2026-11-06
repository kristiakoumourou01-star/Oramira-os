'use client';

import { FileText, Download } from 'lucide-react';
import type { BucketName } from '@/lib/storage-shared';
import { formatDate } from '@/lib/format';

export interface CenterDoc {
  id: string;
  title: string | null;
  category: string;
  storage_path: string;
  bucket: string;
  created_at: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  contract: 'Contracts',
  invoice: 'Invoices & receipts',
  receipt: 'Invoices & receipts',
  legal: 'Legal documents',
  floorplan: 'Floorplans',
  drawing: 'Drawings',
  specification: 'Specifications',
  warranty: 'Warranties',
  manual: 'Appliance manuals',
  marketing: 'Project media',
  other: 'Other documents',
};

/**
 * Buyer Documents Center. Unlike the shared DocumentList (one bucket), the
 * centre spans contracts, unit, and project documents across several private
 * buckets — so it signs each row against its own bucket via the two-arg
 * storage action. Grouped by category into calm, labelled sections.
 */
export function DocumentCenter({
  documents,
  getUrl,
}: {
  documents: CenterDoc[];
  getUrl: (bucket: BucketName, path: string) => Promise<string>;
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-charcoal-600/70">No documents have been shared with you yet.</p>;
  }

  const groups = documents.reduce<Record<string, CenterDoc[]>>((acc, d) => {
    const label = CATEGORY_LABEL[d.category] ?? 'Other documents';
    (acc[label] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([label, docs]) => (
        <div key={label} className="panel p-6">
          <h4 className="mb-4">{label}</h4>
          <ul className="divide-y divide-stone-line">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-olive" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-medium text-charcoal">{doc.title ?? 'Document'}</p>
                    <p className="text-xs text-charcoal-600/50">{formatDate(doc.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const url = await getUrl(doc.bucket as BucketName, doc.storage_path);
                    window.open(url, '_blank');
                  }}
                  className="btn-ghost"
                >
                  <Download size={14} strokeWidth={1.75} /> Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
