export interface ViewAsUser { id: string; name: string; email: string | null; role: string; customRole: string | null; title: string | null; active: boolean }
export interface ViewAsEvent { at: string; started: boolean; by: string; target: string | null }
export const ROLE_EL: Record<string, string> = {
  admin: 'Admin', management: 'Manager', sales: 'Πωλήσεις', finance: 'Οικονομικά', construction: 'Κατασκευή', viewer: 'Μόνο προβολή',
  buyer: 'Αγοραστής', homeowner: 'Ιδιοκτήτης', investor: 'Επενδυτής', contractor: 'Εργολάβος',
};
export const STAFF = ['admin', 'management', 'sales', 'finance', 'construction', 'viewer'];
