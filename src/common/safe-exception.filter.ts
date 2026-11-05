import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('RequestFailure');
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse(), requestId = randomUUID();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const message = status >= 500 ? 'The service could not complete this request. Please retry or contact support.' : error instanceof HttpException ? error.getResponse() : 'Request failed';
    // No payload, token, query string, vendor response, SQL or customer detail in logs.
    if (status >= 500) this.logger.error(JSON.stringify({ requestId, status, category: error instanceof Error ? error.constructor.name : 'UnknownError' }));
    response.status(status).json({ statusCode: status, message: typeof message === 'string' ? message : (message as any).message, requestId });
  }
}
