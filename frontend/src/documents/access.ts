import type { GeneratedDocumentRecord } from '../api/types';

export const DOCUMENT_ACCESS_ROLES = [
  'ADMIN',
  'DIRECTOR',
  'DEPARTMENT_HEAD',
  'MANAGER',
  'LOGIST',
  'FINANCIER',
];

export const DOCUMENT_DOWNLOAD_ROLES = {
  CONTRACT: ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER'],
  CONTRACT_WITHOUT_DEAL: [
    'ADMIN',
    'DIRECTOR',
    'DEPARTMENT_HEAD',
    'MANAGER',
    'LOGIST',
  ],
  TRANSPORT_REQUEST: [
    'ADMIN',
    'DIRECTOR',
    'DEPARTMENT_HEAD',
    'MANAGER',
    'LOGIST',
  ],
  INVOICE: ['ADMIN', 'DIRECTOR', 'DEPARTMENT_HEAD', 'MANAGER', 'FINANCIER'],
} as const;

export function canDownloadDocument(
  document: Pick<GeneratedDocumentRecord, 'type' | 'source'>,
  userRoles: readonly string[],
): boolean {
  const allowedRoles = document.type === 'INVOICE'
    ? DOCUMENT_DOWNLOAD_ROLES.INVOICE
    : document.type === 'TRANSPORT_REQUEST'
      ? DOCUMENT_DOWNLOAD_ROLES.TRANSPORT_REQUEST
      : document.source === null
        ? DOCUMENT_DOWNLOAD_ROLES.CONTRACT_WITHOUT_DEAL
        : DOCUMENT_DOWNLOAD_ROLES.CONTRACT;

  return userRoles.some((role) => (
    allowedRoles as readonly string[]
  ).includes(role));
}
