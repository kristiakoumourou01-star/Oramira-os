/**
 * Translations (Ελληνικά / English / Русский) — client-safe.
 *
 * `t('key')` returns the text in the current user's language (lib/locale-shared).
 * Covered so far: the app shell (menus, top bar, sign-in, 2FA, notifications,
 * Settings menu). Page contents are translated section by section; anything
 * without a translation keeps its original text.
 */
import { currentLocale, type Lang } from '@/lib/locale-shared';

type Tr = Record<Lang, string>;

const DICT = {
  // common
  save: { el: 'Αποθήκευση', en: 'Save', ru: 'Сохранить' },
  cancel: { el: 'Άκυρο', en: 'Cancel', ru: 'Отмена' },
  signOut: { el: 'Αποσύνδεση', en: 'Sign out', ru: 'Выйти' },
  admin: { el: 'Διαχείριση', en: 'Admin', ru: 'Администрирование' },
  search: { el: 'Αναζήτηση ή μετάβαση…', en: 'Search or jump to…', ru: 'Поиск или переход…' },
  password: { el: 'Κωδικός', en: 'Password', ru: 'Пароль' },
  security: { el: 'Ασφάλεια', en: 'Security', ru: 'Безопасность' },
  changePassword: { el: 'Αλλαγή κωδικού', en: 'Change password', ru: 'Сменить пароль' },
  securityHint: { el: 'Κωδικός μίας χρήσης (2FA) και συσκευές', en: 'One-time code (2FA) and devices', ru: 'Одноразовый код (2FA) и устройства' },
  language: { el: 'Γλώσσα', en: 'Language', ru: 'Язык' },
  numbers: { el: 'Αριθμοί', en: 'Numbers', ru: 'Числа' },
  // notifications
  notifications: { el: 'Ειδοποιήσεις', en: 'Notifications', ru: 'Уведомления' },
  nothingYet: { el: 'Τίποτα ακόμη.', en: 'Nothing yet.', ru: 'Пока ничего.' },
  sound: { el: 'Ήχος', en: 'Sound', ru: 'Звук' },
  desktop: { el: 'Υπολογιστή', en: 'Desktop', ru: 'На экран' },
  // sign-in
  signInToContinue: { el: 'Συνδεθείτε για να συνεχίσετε', en: 'Sign in to continue', ru: 'Войдите, чтобы продолжить' },
  email: { el: 'Email', en: 'Email', ru: 'Эл. почта' },
  signIn: { el: 'Σύνδεση', en: 'Sign in', ru: 'Войти' },
  signingIn: { el: 'Σύνδεση…', en: 'Signing in…', ru: 'Вход…' },
  forgotPassword: { el: 'Ξεχάσατε τον κωδικό;', en: 'Forgot your password?', ru: 'Забыли пароль?' },
  enterEmailPassword: { el: 'Γράψτε email και κωδικό.', en: 'Enter your email and password.', ru: 'Введите эл. почту и пароль.' },
  expired: { el: 'Αποσυνδεθήκατε λόγω αδράνειας. Συνδεθείτε ξανά.', en: 'You were signed out after inactivity. Please sign in again.', ru: 'Вы вышли из-за бездействия. Войдите снова.' },
  ipBlocked: { el: 'Η σύνδεση επιτρέπεται μόνο από τα δίκτυα της εταιρείας. Επικοινωνήστε με τον διαχειριστή.', en: 'Sign-in is only allowed from the company network. Please contact your administrator.', ru: 'Вход разрешён только из сети компании. Обратитесь к администратору.' },
  disabled: { el: 'Ο λογαριασμός σας έχει απενεργοποιηθεί. Επικοινωνήστε με τον διαχειριστή.', en: 'Your account has been deactivated. Please contact your administrator.', ru: 'Ваша учётная запись отключена. Обратитесь к администратору.' },
  // 2FA
  oneTimeCode: { el: 'Κωδικός μίας χρήσης', en: 'One-time code', ru: 'Одноразовый код' },
  codeHelp: { el: 'Ανοίξτε την εφαρμογή επαλήθευσης στο κινητό (π.χ. Google ή Microsoft Authenticator) και γράψτε τον κωδικό για το Oramira.', en: 'Open the authenticator app on your phone (e.g. Google or Microsoft Authenticator) and enter the code for Oramira.', ru: 'Откройте приложение-аутентификатор на телефоне (например, Google или Microsoft Authenticator) и введите код для Oramira.' },
  rememberDevice: { el: 'Να με θυμάται αυτή η συσκευή για 30 μέρες', en: 'Remember this device for 30 days', ru: 'Запомнить это устройство на 30 дней' },
  continue: { el: 'Συνέχεια', en: 'Continue', ru: 'Продолжить' },
  checking: { el: 'Έλεγχος…', en: 'Checking…', ru: 'Проверка…' },
  noPhone: { el: 'Δεν έχω το κινητό μου — αποσύνδεση (ο admin μπορεί να μηδενίσει το 2FA)', en: "I don't have my phone — sign out (an admin can reset 2FA)", ru: 'Нет телефона — выйти (администратор может сбросить 2FA)' },
  // roles
  role_admin: { el: 'Διαχειριστής', en: 'Administrator', ru: 'Администратор' },
  role_sales: { el: 'Πωλητής', en: 'Sales Agent', ru: 'Агент по продажам' },
  role_management: { el: 'Manager', en: 'Manager', ru: 'Менеджер' },
  role_finance: { el: 'Λογιστήριο', en: 'Finance', ru: 'Финансы' },
  role_construction: { el: 'Κατασκευή', en: 'Construction', ru: 'Строительство' },
  role_viewer: { el: 'Μόνο προβολή', en: 'Viewer', ru: 'Только просмотр' },
  role_buyer: { el: 'Αγοραστής', en: 'Buyer', ru: 'Покупатель' },
  role_homeowner: { el: 'Ιδιοκτήτης', en: 'Homeowner', ru: 'Владелец' },
  role_investor: { el: 'Επενδυτής', en: 'Investor', ru: 'Инвестор' },
  role_contractor: { el: 'Εργολάβος', en: 'Contractor', ru: 'Подрядчик' },
} satisfies Record<string, Tr>;

export type TKey = keyof typeof DICT;

export function t(key: TKey, lang: Lang = currentLocale().lang): string {
  return DICT[key][lang] ?? DICT[key].el;
}

/**
 * Menu labels by link (internal menu, portal menus, Settings menu). Used only
 * while an entry keeps its default name — a name the admin typed in the menu
 * editor is shown as typed.
 */
const NAV: Record<string, Tr> = {
  '/dashboard': { el: 'Αρχική', en: 'Home', ru: 'Главная' },
  '/dashboard#child': { el: 'My Workspace', en: 'My Workspace', ru: 'Моё рабочее место' },
  '/calendar': { el: 'Ημερολόγιο', en: 'Calendar', ru: 'Календарь' },
  '/command-center': { el: 'Command Center', en: 'Command Center', ru: 'Командный центр' },
  '/crm/leads': { el: 'Πωλήσεις', en: 'Sales', ru: 'Продажи' },
  '/crm/leads?tab=inbox': { el: 'Lead Management', en: 'Lead Management', ru: 'Лиды' },
  '/crm/leads?tab=pipeline': { el: 'Pipeline', en: 'Pipeline', ru: 'Воронка' },
  '/crm/leads?tab=followups': { el: 'Follow-ups', en: 'Follow-ups', ru: 'Напоминания' },
  '/crm/leads?tab=viewings': { el: 'Προβολές', en: 'Viewings', ru: 'Просмотры' },
  '/crm/leads?tab=retargeting': { el: 'Retargeting', en: 'Retargeting', ru: 'Ретаргетинг' },
  '/crm/leads?tab=closings': { el: 'Κλεισίματα & προμήθειες', en: 'Closings & commissions', ru: 'Сделки и комиссии' },
  '/crm/leads?tab=kpis': { el: 'Στατιστικά', en: 'Statistics', ru: 'Статистика' },
  '/crm/customers': { el: 'Πελάτες', en: 'Clients', ru: 'Клиенты' },
  '/crm/customers#child': { el: 'Όλες οι επαφές', en: 'All contacts', ru: 'Все контакты' },
  '/crm/buyers': { el: 'Αγοραστές', en: 'Buyers', ru: 'Покупатели' },
  '/crm/investors': { el: 'Επενδυτές', en: 'Investors', ru: 'Инвесторы' },
  '/property?tab=owners': { el: 'Ιδιοκτήτες', en: 'Owners', ru: 'Владельцы' },
  '/projects': { el: 'Έργα & μονάδες', en: 'Projects & units', ru: 'Проекты и объекты' },
  '/projects#child': { el: 'Έργα', en: 'Projects', ru: 'Проекты' },
  '/map': { el: 'Χάρτης', en: 'Map', ru: 'Карта' },
  '/deal-analyzer': { el: 'Deal Analyzer', en: 'Deal Analyzer', ru: 'Анализ сделок' },
  '/acquisitions': { el: 'Αγορές γης', en: 'Land acquisition', ru: 'Покупка земли' },
  '/acquisitions?tab=pipeline': { el: 'Pipeline', en: 'Pipeline', ru: 'Воронка' },
  '/acquisitions?tab=scoring': { el: 'Αξιολόγηση γης', en: 'Land scoring', ru: 'Оценка участков' },
  '/acquisitions?tab=assembly': { el: 'Συνένωση', en: 'Assembly', ru: 'Объединение' },
  '/acquisitions?tab=outreach': { el: 'Επαφές ιδιοκτητών', en: 'Owner outreach', ru: 'Контакты с владельцами' },
  '/marketing': { el: 'Marketing', en: 'Marketing', ru: 'Маркетинг' },
  '/marketing#child': { el: 'Καμπάνιες', en: 'Campaigns', ru: 'Кампании' },
  '/automation': { el: 'Αυτοματισμοί', en: 'Automations', ru: 'Автоматизации' },
  '/settings/templates': { el: 'Templates', en: 'Templates', ru: 'Шаблоны' },
  '/property': { el: 'Property Management', en: 'Property Management', ru: 'Управление недвижимостью' },
  '/property?tab=houses': { el: 'Ακίνητα', en: 'Properties', ru: 'Объекты' },
  '/property?tab=maintenance': { el: 'Συντήρηση', en: 'Maintenance', ru: 'Обслуживание' },
  '/property?tab=warranties': { el: 'Εγγυήσεις', en: 'Warranties', ru: 'Гарантии' },
  '/property?tab=documents': { el: 'Έγγραφα', en: 'Documents', ru: 'Документы' },
  '/property?tab=history': { el: 'Ιστορικό ιδιοκτησίας', en: 'Ownership history', ru: 'История владения' },
  '/financials': { el: 'Οικονομικά', en: 'Finance', ru: 'Финансы' },
  '/financials#child': { el: 'Επισκόπηση', en: 'Overview', ru: 'Обзор' },
  '/financials/invoices': { el: 'Τιμολόγια', en: 'Invoices', ru: 'Счета' },
  '/hr': { el: 'Ομάδα & HR', en: 'Team & HR', ru: 'Команда и HR' },
  '/hr?tab=team': { el: 'Ομάδα', en: 'Team', ru: 'Команда' },
  '/hr?tab=intelligence': { el: 'HR Intelligence', en: 'HR Intelligence', ru: 'HR-аналитика' },
  '/hr?tab=verification': { el: 'Επαλήθευση υπαλλήλου', en: 'Employee verification', ru: 'Проверка сотрудника' },
  '/hr?tab=salary': { el: 'Μισθοδοσία', en: 'Payroll', ru: 'Зарплата' },
  '/hr?tab=contracts': { el: 'Συμβόλαια', en: 'Contracts', ru: 'Договоры' },
  '/hr?tab=payslips': { el: 'Payslips', en: 'Payslips', ru: 'Расчётные листки' },
  '/hr?tab=leave': { el: 'Άδειες', en: 'Leave', ru: 'Отпуска' },
  '/hr?tab=benefits': { el: 'Παροχές', en: 'Benefits', ru: 'Льготы' },
  '/operations': { el: 'Operations', en: 'Operations', ru: 'Операции' },
  '/reports': { el: 'Αναφορές', en: 'Reports', ru: 'Отчёты' },
  '/reports?tab=board': { el: 'Board pack', en: 'Board pack', ru: 'Отчёт для совета' },
  '/reports?tab=investor': { el: 'Investor report', en: 'Investor report', ru: 'Отчёт для инвесторов' },
  '/reports?tab=strategy': { el: 'Strategy', en: 'Strategy', ru: 'Стратегия' },
  '/reports?tab=knowledge': { el: 'Knowledge graph', en: 'Knowledge graph', ru: 'Граф знаний' },
  '/reports?tab=memory': { el: 'Executive memory', en: 'Executive memory', ru: 'Память руководства' },
  '/settings': { el: 'Ρυθμίσεις', en: 'Settings', ru: 'Настройки' },
  // Settings menu
  'settings:Λογαριασμός': { el: 'Λογαριασμός', en: 'Account', ru: 'Аккаунт' },
  'settings:Χρήστες': { el: 'Χρήστες', en: 'Users', ru: 'Пользователи' },
  'settings:Εργασία': { el: 'Εργασία', en: 'Work', ru: 'Работа' },
  'settings:Χρήματα': { el: 'Χρήματα', en: 'Money', ru: 'Финансы' },
  'settings:Συνδέσεις': { el: 'Συνδέσεις', en: 'Connections', ru: 'Интеграции' },
  'settings:Ασφάλεια & δεδομένα': { el: 'Ασφάλεια & δεδομένα', en: 'Security & data', ru: 'Безопасность и данные' },
  '/settings?section=business': { el: 'Στοιχεία εταιρείας', en: 'Company details', ru: 'Данные компании' },
  '/settings?section=appearance': { el: 'Εμφάνιση', en: 'Appearance', ru: 'Оформление' },
  '/settings?section=layout': { el: 'Μενού & διάταξη', en: 'Menu & layout', ru: 'Меню и макет' },
  '/settings?section=dashboard': { el: 'Dashboard', en: 'Dashboard', ru: 'Панель' },
  '/settings/users': { el: 'Χρήστες & πρόσβαση', en: 'Users & access', ru: 'Пользователи и доступ' },
  '/settings/roles': { el: 'Ρόλοι & δικαιώματα', en: 'Roles & permissions', ru: 'Роли и права' },
  '/settings/view-as': { el: 'Προβολή ως χρήστης', en: 'View as user', ru: 'Просмотр от имени' },
  '/settings?section=notifications': { el: 'Ειδοποιήσεις', en: 'Notifications', ru: 'Уведомления' },
  '/settings?section=tags': { el: 'Tags & πεδία', en: 'Tags & fields', ru: 'Теги и поля' },
  '/settings?section=departments': { el: 'Τμήματα', en: 'Departments', ru: 'Отделы' },
  '/settings?section=customerFields': { el: 'Πεδία πελατών', en: 'Customer fields', ru: 'Поля клиентов' },
  '/settings?section=pipelines': { el: 'Pipelines & φόρμες', en: 'Pipelines & forms', ru: 'Воронки и формы' },
  '/settings?section=leads': { el: 'Leads & αυτοματισμοί', en: 'Leads & automation', ru: 'Лиды и автоматизация' },
  '/crm/duplicates': { el: 'Διπλές επαφές', en: 'Duplicate contacts', ru: 'Дубликаты контактов' },
  '/settings?section=unitforms': { el: 'Φόρμες μονάδων', en: 'Unit forms', ru: 'Формы объектов' },
  '/settings?section=portals': { el: 'Portals πελατών', en: 'Client portals', ru: 'Порталы клиентов' },
  '/settings?section=invoices': { el: 'Τιμολόγια & ΦΠΑ', en: 'Invoices & VAT', ru: 'Счета и НДС' },
  '/settings?section=integrations': { el: 'Integrations', en: 'Integrations', ru: 'Интеграции' },
  '/settings?section=security': { el: 'Ασφάλεια', en: 'Security', ru: 'Безопасность' },
  '/settings?section=gdpr': { el: 'GDPR & δεδομένα', en: 'GDPR & data', ru: 'GDPR и данные' },
  '/settings/audit': { el: 'Audit log', en: 'Audit log', ru: 'Журнал аудита' },
  // portals
  '/buyer': { el: 'Επισκόπηση', en: 'Overview', ru: 'Обзор' },
  '/buyer/my-unit': { el: 'Η μονάδα μου', en: 'My Unit', ru: 'Мой объект' },
  '/buyer/payments': { el: 'Πληρωμές', en: 'Payment Center', ru: 'Платежи' },
  '/buyer/construction': { el: 'Κατασκευή', en: 'Construction', ru: 'Строительство' },
  '/buyer/documents': { el: 'Έγγραφα', en: 'Documents', ru: 'Документы' },
  '/buyer/messages': { el: 'Μηνύματα', en: 'Messages', ru: 'Сообщения' },
  '/buyer/handover': { el: 'Παράδοση', en: 'Handover', ru: 'Передача ключей' },
  '/homeowner': { el: 'Επισκόπηση', en: 'Overview', ru: 'Обзор' },
  '/homeowner/project': { el: 'Το ακίνητό μου', en: 'My Property', ru: 'Моя недвижимость' },
  '/homeowner/maintenance': { el: 'Συντήρηση', en: 'Maintenance', ru: 'Обслуживание' },
  '/homeowner/warranty': { el: 'Εγγύηση', en: 'Warranty', ru: 'Гарантия' },
  '/homeowner/contractor': { el: 'Εργολάβος', en: 'Contractor', ru: 'Подрядчик' },
  '/homeowner/documents': { el: 'Έγγραφα σπιτιού', en: 'Home Documents', ru: 'Документы' },
  '/homeowner/history': { el: 'Ιστορικό ακινήτου', en: 'Property History', ru: 'История объекта' },
  '/homeowner/notifications': { el: 'Ειδοποιήσεις', en: 'Notifications', ru: 'Уведомления' },
  '/investor': { el: 'Επισκόπηση', en: 'Overview', ru: 'Обзор' },
  '/contractor': { el: 'Οι εργασίες μου', en: 'Assigned Jobs', ru: 'Мои работы' },
  '/contractor/schedule': { el: 'Πρόγραμμα', en: 'Schedule', ru: 'График' },
  '/contractor/invoices': { el: 'Τιμολόγια', en: 'Invoices', ru: 'Счета' },
  '/contractor/performance': { el: 'Απόδοση', en: 'Performance', ru: 'Показатели' },
  '/help': { el: 'Βοήθεια', en: 'Help', ru: 'Помощь' },
};

/**
 * Translate a menu label. `key` is the link (or a group key); `fallback` is the
 * label as shown today. A label the admin renamed (≠ any known default) stays.
 */
export function navLabel(key: string, fallback: string, lang: Lang = currentLocale().lang): string {
  // A sub-item that shares its parent's link has its own entry ("<link>#child").
  for (const tr of [NAV[key], NAV[`${key}#child`]]) {
    if (tr && (fallback === tr.el || fallback === tr.en || fallback === tr.ru)) return tr[lang];
  }
  return fallback;
}
