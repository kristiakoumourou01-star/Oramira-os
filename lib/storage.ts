import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Storage buckets are split by sensitivity, not lumped into one — see
 * Phase 1. Every upload/download in the app should go through these
 * helpers so the bucket choice and signed-URL expiry stay consistent.
 */
export const BUCKETS = {
  projectMedia: 'project-media', // gallery, floorplans — broader read access
  contracts: 'contracts', // private, signed URLs only
  defectReports: 'defect-reports', // homeowner ticket photos
  investorDocuments: 'investor-documents',
  contractorInvoices: 'contractor-invoices',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Uploads a file and records it in the polymorphic `documents` table in one step. */
export async function uploadDocument(params: {
  bucket: BucketName;
  path: string;
  file: File | Blob;
  category: string;
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const supabase = await createSupabaseServerClient();

  const { error: uploadError } = await supabase.storage
    .from(params.bucket)
    .upload(params.path, params.file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('documents')
    .insert({
      bucket: params.bucket,
      storage_path: params.path,
      category: params.category,
      entity_type: params.entityType,
      entity_id: params.entityId,
      title: params.title ?? null,
      uploaded_by: auth.user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Signed URL, short-lived — never serve documents from a public path. */
export async function getSignedDocumentUrl(bucket: BucketName, path: string, expiresInSeconds = 300) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
