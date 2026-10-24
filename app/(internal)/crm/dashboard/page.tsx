import { redirect } from 'next/navigation';
/** Consolidated into the single Sales workspace page (in-page tabs). */
export default function Redirect() {
  redirect('/crm/leads');
}
