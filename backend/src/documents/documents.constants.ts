import * as path from 'node:path';

export const TEMPLATES_DIR = path.join(__dirname, 'templates');

export const TEMPLATE_PATHS = {
  CONTRACT: path.join(TEMPLATES_DIR, 'contract.docx'),
  TRANSPORT_REQUEST: path.join(TEMPLATES_DIR, 'transport-request.docx'),
} as const;
