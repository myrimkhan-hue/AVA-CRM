import { documentContact } from './document-contact';

describe('Контакт сотрудника для документов', () => {
  it('использует обычные ФИО и телефон, если специальные поля пусты', () => {
    expect(documentContact({
      fullName: 'Иванов Иван Иванович',
      phone: '+7 701 000 00 00',
      documentName: null,
      documentPhone: null,
    })).toEqual({
      name: 'Иванов Иван Иванович',
      phone: '+7 701 000 00 00',
    });
  });

  it('использует имя и телефон, заданные специально для документов', () => {
    expect(documentContact({
      fullName: 'Иванов Иван Иванович',
      phone: '+7 701 000 00 00',
      documentName: 'Иван Иванов',
      documentPhone: '+7 777 111 22 33',
    })).toEqual({
      name: 'Иван Иванов',
      phone: '+7 777 111 22 33',
    });
  });

  it('ставит тире, если не заполнен ни один телефон', () => {
    expect(documentContact({
      fullName: 'Иванов Иван Иванович',
      phone: null,
      documentName: null,
      documentPhone: null,
    }).phone).toBe('—');
  });
});
