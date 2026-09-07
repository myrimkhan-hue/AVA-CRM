import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { ru } from '../locales/ru';

/**
 * Слишком большое число не помещается в колонку базы, PostgreSQL отвечает
 * ошибкой 22003 «numeric field overflow», и без этого фильтра пользователь
 * видел «Internal server error» — то есть выглядело как поломка системы,
 * хотя виновата опечатка в сумме или в весе.
 *
 * Фильтр ловит именно этот случай и превращает его в обычную ошибку ввода.
 * Все остальные ошибки Prisma намеренно передаются дальше без изменений:
 * настоящие сбои должны оставаться пятисотками и попадать в лог, иначе
 * мы спрячем реальную поломку под видом «неверных данных».
 *
 * Это защитная сетка, а не замена проверкам: у полей есть и свои ограничения
 * в DTO, они дают более понятное сообщение с названием поля. Сетка нужна для
 * полей, которым ограничение забыли поставить, — и для тех, что появятся позже.
 */
@Catch(Prisma.PrismaClientUnknownRequestError, Prisma.PrismaClientKnownRequestError)
export class NumericOverflowFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(exception: unknown, host: ArgumentsHost): void {
    if (isNumericOverflow(exception)) {
      super.catch(new BadRequestException(ru.common.numericOverflow), host);
      return;
    }
    super.catch(exception, host);
  }
}

function isNumericOverflow(exception: unknown): boolean {
  const message = exception instanceof Error ? exception.message : '';
  return message.includes('22003') || message.includes('numeric field overflow');
}
