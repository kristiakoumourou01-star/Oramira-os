import { redirect } from 'next/navigation';

/** Ίδια λίστα με όλες τις επαφές, φιλτραρισμένη στους αγοραστές. */
export default function Page() {
  redirect('/crm/customers?role=buyer');
}
