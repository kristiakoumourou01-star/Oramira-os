import { redirect } from 'next/navigation';

/** Ίδια λίστα με όλες τις επαφές, φιλτραρισμένη στους επενδυτές. */
export default function Page() {
  redirect('/crm/customers?role=investor');
}
