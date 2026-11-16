/** Staff → Υπάλληλοι: client-safe τύποι για την καρτέλα υπαλλήλου. */

export interface EmployeeDoc { id: string; title: string; kind: string; bucket: string; path: string; createdAt: string; expires: string | null }

export interface EmployeeHr {
  jobTitle: string | null; department: string | null; phone: string | null; personalEmail: string | null;
  employmentType: string | null; startDate: string | null; endDate: string | null; terminationReason: string | null;
  dateOfBirth: string | null; nationality: string | null; idPassport: string | null; socialInsuranceNo: string | null;
  address: string | null; emergencyContact: string | null; agreedSalary: number | null; salaryFrequency: string | null; hrNotes: string | null;
  createdAt: string | null;
  docs: EmployeeDoc[];
  /** Η πιο πρόσφατη σύμβαση (έγγραφο τύπου «Σύμβαση»). */
  contract: EmployeeDoc | null;
  /** Ενεργή σύμβαση από το HR (λήξη). */
  contractExpiry: string | null;
  onLeaveToday: boolean;
}

export const EMPLOYMENT_TYPES: [string, string][] = [['full_time', 'Πλήρης απασχόληση'], ['part_time', 'Μερική απασχόληση'], ['contractor', 'Εξωτερικός συνεργάτης'], ['intern', 'Πρακτική'], ['seasonal', 'Εποχική']];
export const EMPLOYMENT_TYPE_EL: Record<string, string> = Object.fromEntries(EMPLOYMENT_TYPES);
export const DOC_KIND_EL: Record<string, string> = { id: 'Ταυτότητα / Διαβατήριο', contract: 'Σύμβαση', cv: 'Βιογραφικό', certificate: 'Πιστοποιητικό', medical: 'Ιατρικό', payroll: 'Μισθοδοσία', other: 'Άλλο' };

export const EMPTY_HR: EmployeeHr = {
  jobTitle: null, department: null, phone: null, personalEmail: null, employmentType: null, startDate: null, endDate: null, terminationReason: null,
  dateOfBirth: null, nationality: null, idPassport: null, socialInsuranceNo: null, address: null, emergencyContact: null, agreedSalary: null,
  salaryFrequency: null, hrNotes: null, createdAt: null, docs: [], contract: null, contractExpiry: null, onLeaveToday: false,
};

/** Τερματισμένος = έχει ημερομηνία λήξης συνεργασίας που έχει περάσει. */
export const isTerminated = (hr: Pick<EmployeeHr, 'endDate'>) => !!hr.endDate && hr.endDate <= new Date().toISOString().slice(0, 10);
