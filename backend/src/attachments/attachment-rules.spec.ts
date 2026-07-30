import { BadRequestException } from '@nestjs/common';
import * as path from 'node:path';
import {
  ALLOWED_EXTENSIONS,
  assertUploadAllowed,
  buildStoredName,
  fileExtension,
  formatFileSize,
  isAllowedExtension,
  resolveStoredPath,
  sanitizeFileName,
} from './attachment-rules';

describe('Разрешённые типы файлов', () => {
  it('пропускает документы и картинки', () => {
    for (const name of ['договор.pdf', 'акт.docx', 'реестр.xlsx', 'скан.jpg', 'фото.PNG', 'архив.zip']) {
      expect(isAllowedExtension(name)).toBe(true);
    }
  });

  it('не пропускает исполняемые файлы и скрипты', () => {
    for (const name of ['вирус.exe', 'script.js', 'run.bat', 'lib.dll', 'shell.sh', 'macro.docm']) {
      expect(isAllowedExtension(name)).toBe(false);
    }
  });

  it('не пропускает SVG — внутри может быть скрипт', () => {
    expect(isAllowedExtension('картинка.svg')).toBe(false);
  });

  it('не пропускает файл без расширения и с двойным расширением-обманкой', () => {
    expect(isAllowedExtension('файл')).toBe(false);
    expect(isAllowedExtension('договор.pdf.exe')).toBe(false);
  });

  it('расширение определяется без учёта регистра', () => {
    expect(fileExtension('СКАН.JPEG')).toBe('.jpeg');
  });
});

describe('assertUploadAllowed', () => {
  it('пропускает нормальный файл', () => {
    expect(() => assertUploadAllowed({ originalname: 'скан.pdf', size: 1024 }, 25)).not.toThrow();
  });

  it('отклоняет отсутствующий файл', () => {
    expect(() => assertUploadAllowed(undefined, 25)).toThrow('Файл не передан');
  });

  it('отклоняет пустой файл', () => {
    expect(() => assertUploadAllowed({ originalname: 'скан.pdf', size: 0 }, 25)).toThrow('Файл пустой');
  });

  it('отклоняет запрещённый тип', () => {
    expect(() => assertUploadAllowed({ originalname: 'вирус.exe', size: 10 }, 25))
      .toThrow(BadRequestException);
  });

  it('отклоняет файл больше предела и называет предел', () => {
    expect(() => assertUploadAllowed({ originalname: 'скан.pdf', size: 26 * 1024 * 1024 }, 25))
      .toThrow('Файл больше 25 МБ — уменьшите размер или разбейте на части');
  });

  it('учитывает настроенный предел, а не только значение по умолчанию', () => {
    expect(() => assertUploadAllowed({ originalname: 'скан.pdf', size: 6 * 1024 * 1024 }, 5))
      .toThrow('Файл больше 5 МБ');
    expect(() => assertUploadAllowed({ originalname: 'скан.pdf', size: 6 * 1024 * 1024 }, 50))
      .not.toThrow();
  });

  it('файл ровно по пределу проходит', () => {
    expect(() => assertUploadAllowed({ originalname: 'скан.pdf', size: 25 * 1024 * 1024 }, 25))
      .not.toThrow();
  });
});

describe('Имя файла на диске', () => {
  it('не содержит оригинального имени — только случайный идентификатор и расширение', () => {
    const stored = buildStoredName('очень секретный договор.pdf');
    expect(stored).not.toContain('секретный');
    expect(stored.endsWith('.pdf')).toBe(true);
  });

  it('каждый раз разное, даже для одинакового имени', () => {
    expect(buildStoredName('скан.pdf')).not.toBe(buildStoredName('скан.pdf'));
  });

  it('не переносит путь из имени, присланного клиентом', () => {
    const stored = buildStoredName('../../../etc/passwd.pdf');
    expect(stored).not.toContain('..');
    expect(stored).not.toContain('/');
  });
});

describe('sanitizeFileName', () => {
  it('отсекает путь и оставляет только имя', () => {
    expect(sanitizeFileName('C:\\Users\\Батыр\\договор.pdf')).toBe('договор.pdf');
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
  });

  it('убирает управляющие символы', () => {
    expect(sanitizeFileName('дого\u0000вор\u001F.pdf')).toBe('договор.pdf');
  });

  it('подставляет запасное имя для пустого', () => {
    expect(sanitizeFileName('')).toBe('файл');
    expect(sanitizeFileName('   ')).toBe('файл');
  });

  it('обрезает слишком длинное имя', () => {
    expect(sanitizeFileName('я'.repeat(400)).length).toBe(200);
  });
});

describe('resolveStoredPath', () => {
  const dir = path.join('/app', 'uploads');

  it('возвращает путь внутри папки хранилища', () => {
    expect(resolveStoredPath(dir, 'abc.pdf')).toBe(path.resolve(dir, 'abc.pdf'));
  });

  it('не даёт выйти за пределы папки хранилища', () => {
    expect(() => resolveStoredPath(dir, '../../etc/passwd')).toThrow('Некорректный путь к файлу');
    expect(() => resolveStoredPath(dir, '..')).toThrow('Некорректный путь к файлу');
  });
});

describe('formatFileSize', () => {
  it('показывает размер понятно человеку', () => {
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(2048)).toBe('2 КБ');
    expect(formatFileSize(1572864)).toBe('1.5 МБ');
  });
});

describe('Список разрешённых расширений', () => {
  it('все записаны с точкой и в нижнем регистре', () => {
    for (const ext of ALLOWED_EXTENSIONS) {
      expect(ext).toMatch(/^\.[a-z0-9]+$/);
    }
  });
});
