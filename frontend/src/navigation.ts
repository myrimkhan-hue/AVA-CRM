import { DOCUMENT_ACCESS_ROLES } from './documents/access';

export type NavigationIconName =
  | 'dashboard'
  | 'quotes'
  | 'transportations'
  | 'deals'
  | 'leads'
  | 'contractors'
  | 'invoices'
  | 'paymentRequests'
  | 'documents'
  | 'operatingExpenses'
  | 'cashCalendar'
  | 'reports'
  | 'motivation'
  | 'users'
  | 'settings';

export type NavigationItemId = NavigationIconName;

export interface NavigationItem {
  id: NavigationItemId;
  path: string;
  labelKey: string;
  icon: NavigationIconName;
  badge?: number;
  isVisible: (roles: string[]) => boolean;
}

const LEAD_ROLES = ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'];
const INVOICE_ROLES = ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER'];
const REPORT_ROLES = ['ADMIN', 'DIRECTOR', 'FINANCIER'];
const SETTINGS_ROLES = ['ADMIN', 'FINANCIER'];
const QUOTE_ROLES = ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'LOGIST'];

const visibleToEveryone = () => true;
const hasAnyRole = (roles: string[], allowedRoles: string[]) =>
  roles.some((role) => allowedRoles.includes(role));

export const NAVIGATION_GROUPS: NavigationItem[][] = [
  [
    {
      id: 'dashboard',
      path: '/reports/dashboard',
      labelKey: 'nav.dashboard',
      icon: 'dashboard',
      isVisible: (roles) => hasAnyRole(roles, REPORT_ROLES),
    },
    {
      id: 'quotes',
      path: '/quotes',
      labelKey: 'nav.quotes',
      icon: 'quotes',
      isVisible: (roles) => hasAnyRole(roles, QUOTE_ROLES),
    },
    {
      id: 'transportations',
      path: '/transportations',
      labelKey: 'nav.transportations',
      icon: 'transportations',
      isVisible: visibleToEveryone,
    },
    {
      id: 'deals',
      path: '/deals',
      labelKey: 'nav.deals',
      icon: 'deals',
      isVisible: (roles) => !(roles.length === 1 && roles[0] === 'LOGIST'),
    },
    {
      id: 'leads',
      path: '/leads',
      labelKey: 'nav.leads',
      icon: 'leads',
      isVisible: (roles) => hasAnyRole(roles, LEAD_ROLES),
    },
    {
      id: 'contractors',
      path: '/contractors',
      labelKey: 'nav.contractors',
      icon: 'contractors',
      isVisible: visibleToEveryone,
    },
  ],
  [
    {
      id: 'invoices',
      path: '/invoices',
      labelKey: 'nav.invoices',
      icon: 'invoices',
      isVisible: (roles) => hasAnyRole(roles, INVOICE_ROLES),
    },
    {
      id: 'paymentRequests',
      path: '/payment-requests',
      labelKey: 'nav.paymentRequests',
      icon: 'paymentRequests',
      isVisible: visibleToEveryone,
    },
    {
      id: 'documents',
      path: '/documents',
      labelKey: 'nav.documents',
      icon: 'documents',
      isVisible: (roles) => hasAnyRole(roles, DOCUMENT_ACCESS_ROLES),
    },
    {
      id: 'operatingExpenses',
      path: '/operating-expenses',
      labelKey: 'nav.operatingExpenses',
      icon: 'operatingExpenses',
      isVisible: (roles) => hasAnyRole(roles, REPORT_ROLES),
    },
    {
      id: 'cashCalendar',
      path: '/reports/cash-calendar',
      labelKey: 'nav.cashCalendar',
      icon: 'cashCalendar',
      isVisible: (roles) => hasAnyRole(roles, REPORT_ROLES),
    },
    {
      id: 'reports',
      path: '/reports/receivables',
      labelKey: 'nav.reports',
      icon: 'reports',
      isVisible: (roles) => hasAnyRole(roles, REPORT_ROLES),
    },
  ],
  [
    {
      id: 'motivation',
      path: '/motivation',
      labelKey: 'nav.motivation',
      icon: 'motivation',
      isVisible: visibleToEveryone,
    },
    {
      id: 'users',
      path: '/users',
      labelKey: 'nav.users',
      icon: 'users',
      isVisible: (roles) => roles.includes('ADMIN'),
    },
    {
      id: 'settings',
      path: '/settings',
      labelKey: 'nav.settings',
      icon: 'settings',
      isVisible: (roles) => hasAnyRole(roles, SETTINGS_ROLES),
    },
  ],
];

export function getVisibleNavigationGroups(roles: string[]): NavigationItem[][] {
  return NAVIGATION_GROUPS
    .map((group) => group.filter((item) => item.isVisible(roles)))
    .filter((group) => group.length > 0);
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.id === 'dashboard') return pathname === '/reports/dashboard';
  if (item.id === 'cashCalendar') return pathname === '/reports/cash-calendar';
  if (item.id === 'reports') {
    return pathname === '/reports/receivables' || pathname === '/reports/payables';
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

export function getHeaderTitleKey(pathname: string): string {
  if (pathname === '/quotes/new') return 'header.quoteNew';
  if (/^\/quotes\/[^/]+$/.test(pathname)) return 'header.quoteDetail';
  if (pathname === '/transportations/new') return 'header.transportationNew';
  if (/^\/transportations\/[^/]+$/.test(pathname)) return 'header.transportationDetail';
  if (/^\/deals\/[^/]+$/.test(pathname)) return 'header.dealDetail';
  if (pathname === '/profile') return 'header.profile';

  return NAVIGATION_GROUPS
    .flat()
    .find((item) => isNavigationItemActive(item, pathname))?.labelKey ?? 'app.title';
}
