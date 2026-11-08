/** Client-safe types for @/lib/calendar-feed (the server reads stay there). */

export type CalendarSource = 'internal' | 'viewing' | 'google' | 'activity';

export interface CalendarItem {
  id: string;
  source: CalendarSource;
  type: string; // meeting | viewing | followup | task | reminder | google
  title: string;
  start: string; // ISO
  durationMin: number;
  status: string | null;
  color: string | null;
  location: string | null;
  meetingLink: string | null;
  leadId: string | null;
  editable: boolean; // internal rows can be edited/cancelled in-app
}
