import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ru } from '../../locales/ru';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = ru.auth.tooManyLoginAttempts;
}
