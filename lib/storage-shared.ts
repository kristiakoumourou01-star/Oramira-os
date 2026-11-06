/** Client-safe storage constants + types (no server imports). */
export const BUCKETS = {
  projectMedia: 'project-media', // gallery, floorplans — broader read access
  contracts: 'contracts', // private, signed URLs only
  defectReports: 'defect-reports', // homeowner ticket photos
  investorDocuments: 'investor-documents',
  contractorInvoices: 'contractor-invoices',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
