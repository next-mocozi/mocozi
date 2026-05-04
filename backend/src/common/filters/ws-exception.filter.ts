import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket 예외 필터 — 일관된 에러 페이로드를 클라이언트에 emit
 *
 * Service 계층에서 던지는 HttpException(Forbidden/NotFound/BadRequest 등)을
 * WS 컨텍스트에 맞게 'exception' 이벤트로 변환한다.
 *
 * 클라이언트:
 *   socket.on('exception', (err) => err.message === 'Forbidden' | 'NotFound' | ...)
 *
 * 적용: @UseFilters(WsAllExceptionFilter) — ChatGateway 클래스 레벨
 */
@Catch()
export class WsAllExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const data = host.switchToWs().getData();

    const { code, message } = this.translate(exception);

    client.emit('exception', {
      code,
      message,
      // 어떤 이벤트의 응답인지 클라이언트가 매칭할 수 있게 (선택적)
      payload: data ?? null,
    });
  }

  private translate(exception: unknown): { code: string; message: string } {
    if (exception instanceof WsException) {
      const err = exception.getError();
      const message = typeof err === 'string' ? err : (err as any).message ?? 'WsError';
      return { code: this.codeFromMessage(message), message };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as any).message as string) || exception.message;

      switch (status) {
        case 400:
          return { code: 'BadRequest', message };
        case 401:
          return { code: 'Unauthorized', message };
        case 403:
          return { code: 'Forbidden', message };
        case 404:
          return { code: 'NotFound', message };
        case 409:
          return { code: 'Conflict', message };
        default:
          return { code: 'HttpError', message };
      }
    }

    if (exception instanceof Error) {
      return { code: 'InternalError', message: exception.message };
    }

    return { code: 'InternalError', message: '서버 오류가 발생했습니다.' };
  }

  private codeFromMessage(message: string): string {
    if (message.toLowerCase().includes('unauthorized')) return 'Unauthorized';
    if (message.toLowerCase().includes('forbidden')) return 'Forbidden';
    if (message.toLowerCase().includes('not found')) return 'NotFound';
    return 'WsError';
  }
}
