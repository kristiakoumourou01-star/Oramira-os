'use server';

import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { getSignedDocumentUrl, type BucketName } from '@/lib/storage';

/**
 * Thin server action so Client Components (DocumentList, ProjectGallery) can
 * resolve a short-lived signed URL on demand without importing storage
 * helpers into the client bundle. Access is still governed by Storage RLS
 * (migration 0008) under the caller's own session — this only gates that a
 * signed-in user is asking.
 */
export async function getDocumentUrl(bucket: BucketName, path: string): Promise<string> {
  await requireProfile();
  return getSignedDocumentUrl(bucket, path);
}

/**
 * Form-action variant: signs the document URL and redirects the browser to
 * it. Safe to use as `openDocument.bind(null, bucket, path)` on a <form
 * action> in a Server Component (no inline closure over loop variables).
 */
export async function openDocument(bucket: BucketName, path: string): Promise<void> {
  await requireProfile();
  const url = await getSignedDocumentUrl(bucket, path);
  redirect(url);
}
