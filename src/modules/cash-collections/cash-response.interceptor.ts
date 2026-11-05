import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';

@Injectable()
export class CashResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const response = context.switchToHttp().getResponse();
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Vary', 'Authorization');
    const sanitize = (value: any): any => {
      if (Array.isArray(value)) return value.map(sanitize);
      if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
      const result = { ...value };
      if ('cashUserId' in result && 'amountCollected' in result) { result.collectorId = result.cashUserId; delete result.cashUserId; delete result.legacyCollector; }
      if (result.items) result.items = result.items.map(sanitize);
      return result;
    };
    return next.handle().pipe(map(sanitize));
  }
}
