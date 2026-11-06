import {
  LayoutDashboard, TrendingUp, Contact, Building2, Map, Megaphone, Home, Wallet, UserCog, ClipboardList,
  FileBarChart, Settings, CalendarDays, Users, Briefcase, HardHat, Hammer, KeyRound, Landmark, LineChart,
  PieChart, Target, Inbox, MessageSquare, Mail, Phone, FileText, FolderOpen, Star, Zap, Globe, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/** Name → icon for menu entries (names listed in lib/nav NAV_ICON_NAMES). */
export const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, TrendingUp, Contact, Building2, Map, Megaphone, Home, Wallet, UserCog, ClipboardList,
  FileBarChart, Settings, CalendarDays, Users, Briefcase, HardHat, Hammer, KeyRound, Landmark, LineChart,
  PieChart, Target, Inbox, MessageSquare, Mail, Phone, FileText, FolderOpen, Star, Zap, Globe, ShieldCheck,
};

export function navIcon(name: string | undefined): LucideIcon {
  return (name && NAV_ICONS[name]) || LayoutDashboard;
}
