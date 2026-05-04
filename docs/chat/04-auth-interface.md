# DM 모듈 ↔ 인증 모듈 통합 인터페이스

> **수신자**: 인증 시스템 담당자
> **목적**: 두 모듈이 매끄럽게 통합되기 위한 인터페이스 합의
> **버전**: v2 (현재 코드베이스 기준)

---

## TL;DR

DM 모듈은 **인증 모듈이 발급한 JWT 토큰**을 신뢰하고 사용합니다. 합의 사항 4개 + 함께 고쳐야 할 보안 결함 2개가 있습니다.

---

## 1. 합의 사항 (4가지)

### 1-1. JWT Payload — 현재 형식 그대로 유지

현재 `backend/src/auth/auth.service.ts:64`의 sign 코드 그대로:

```typescript
const payload = { sub: user.id, email: user.email };
const token = this.jwtService.sign(payload);
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `sub` | string (UUID) | User.id (JWT 표준에서 subject = 사용자 식별자) |
| `email` | string | 학교 이메일 (.ac.kr) |
| `iat`, `exp` | number | JWT 표준 (자동 추가) |

**`name`/`university`는 토큰에 넣지 않습니다**. 이유:
- `JwtStrategy.validate()`가 이미 DB 조회로 User 객체를 `request.user`에 주입
- `name`처럼 변경 가능 필드를 토큰에 박으면 닉네임 변경 후 토큰 만료까지 옛 값 유지 (stale)
- 토큰 크기 최소화

DM 모듈은 컨트롤러에서 `request.user.id`, `request.user.name` 자유롭게 사용.

### 1-2. JWT 비밀키 공유

`.env`의 `JWT_SECRET`을 양 모듈이 동일하게 사용. 알고리즘은 HS256.

```bash
# .env (양쪽 동일)
JWT_SECRET=<랜덤_64자_이상_문자열>
JWT_REFRESH_SECRET=<JWT_SECRET과 다른 별도 값>
```

키 생성:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 1-3. 토큰 전달 방식

#### REST API
```http
GET /api/conversations
Authorization: Bearer <JWT_TOKEN>
```
현재 `JwtAuthGuard`로 자동 처리. 변경 불필요.

#### WebSocket
```typescript
// 프론트엔드
const socket = io('http://localhost:8080', {
  auth: { token: '<JWT_TOKEN>' }
});
```

DM 모듈이 신설할 `WsJwtGuard`가 처리. 인증 모듈 변경 없음.

### 1-4. 토큰 갱신 정책 — access 1시간 + refresh 30일

**채택 (Phase A에 도입)**:
- access token: `expiresIn: '1h'`
- refresh token: 30일 유효, DB에 저장 → revoke 가능

```bash
# backend/.env (신규 변수)
JWT_REFRESH_SECRET=<별도 랜덤값>
```

**구현 책임**: 인증 담당자.

**필요한 신규 작업**:
- `backend/src/auth/auth.module.ts:13` — `expiresIn: '7d'` → `'1h'`
- `backend/src/auth/auth.service.ts:64-65` — refresh sign + DB 저장 흐름 추가
- `backend/.env.example` — `JWT_REFRESH_SECRET` 변수 추가
- (신규) `POST /api/auth/refresh` 엔드포인트 — refresh로 새 access 발급
- (신규) `User.refreshTokenHash` 필드 (또는 별도 `RefreshToken` 테이블)

**DM 모듈 영향**: 없음. DM은 access token만 검증함.

---

## 2. 같이 고쳐야 할 보안 결함 (2가지)

### 2-1. ⚠️ `'fallback_secret'` 폴백 제거 — 위험도 높음

**위치**: `backend/src/auth/strategies/jwt.strategy.ts:12`

```typescript
// 현재 (위험)
secretOrKey: process.env.JWT_SECRET || 'fallback_secret',
```

**문제**:
- `JWT_SECRET` env 누락 시 자동으로 `'fallback_secret'` 사용
- 이 코드가 깃헙에 올라간 순간 fallback 값이 공개됨
- 누구든 가짜 토큰 무한 발급 가능 → 학교 인증 시스템 의미 상실

**수정**:
```typescript
secretOrKey: process.env.JWT_SECRET,  // env 누락 시 startup에서 즉시 실패
```

또는 `app.module.ts`에서 `ConfigModule`로 필수 env 검증 추가 (더 견고):
```typescript
ConfigModule.forRoot({
  validationSchema: Joi.object({
    JWT_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    DATABASE_URL: Joi.string().required(),
  }),
})
```

**책임**: 인증 담당자. **schema PR과 의존성 0**, 한 줄 수정.

### 2-2. ⚠️ WebSocket Gateway에 인증 가드 부재 — 위험도 매우 높음

**위치**: `backend/src/chat/chat.gateway.ts:60`

```typescript
// 현재 (위조 가능)
@SubscribeMessage('sendMessage')
async handleMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { roomId: string; senderId: string; content: string },  // ⚠️
) {
  const message = await this.chatService.saveMessage(
    data.roomId, data.senderId, data.content
  );
}
```

**문제**: 누구든 `senderId`를 위조해서 다른 사용자 행세 가능. 학교 이메일 인증의 신뢰성 자체를 무너뜨림.

**수정 책임**: DM 담당(나). 아래 §3 `WsJwtGuard` 신설 + 게이트웨이 패치.

**즉시 조치**: `WsJwtGuard` 머지 전까지 정식 데모/배포 금지.

---

## 3. WsJwtGuard 신설 (참고용 — DM 담당이 작성)

**위치**: `backend/src/auth/guards/ws-jwt.guard.ts` (신규)

이 코드는 DM 담당이 작성하지만, 인증 담당자도 알아둘 필요 있음 (토큰을 어떻게 사용하는지).

```typescript
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth?.token;

      if (!token) throw new WsException('No token provided');

      const payload = this.jwtService.verify<JwtPayload>(token);
      // socket 인스턴스에 인증 정보 주입 — 핸들러에서 client.data.user.id로 접근
      (client.data as any).user = { id: payload.sub, email: payload.email };

      return true;
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      throw new WsException('Unauthorized');
    }
  }
}
```

게이트웨이 적용:
```typescript
@UseGuards(WsJwtGuard)
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
export class ChatGateway implements OnGatewayConnection {
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      const payload = this.jwtService.verify(token);
      client.data.user = { id: payload.sub, email: payload.email };
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string; parentId?: string },
  ) {
    const senderId = client.data.user.id;  // 토큰에서 가져옴 (위조 불가)
    const message = await this.chatService.saveMessage(
      data.roomId, senderId, data.content, data.parentId
    );
    this.server.to(data.roomId).emit('message:new', message);
  }
}
```

---

## 4. 책임 분리 체크리스트

### 인증 담당자가 할 일
- [ ] §2-1 `'fallback_secret'` 폴백 제거 (필수, 시급)
- [ ] (권장) `ConfigModule`로 env 필수 검증 추가
- [ ] §1-4 refresh token 시스템 도입
  - [ ] `expiresIn: '1h'` 변경
  - [ ] `JWT_REFRESH_SECRET` 환경변수 추가
  - [ ] refresh token DB 저장 흐름
  - [ ] `POST /api/auth/refresh` 엔드포인트
  - [ ] `User.refreshTokenHash` 또는 별도 `RefreshToken` 테이블

### DM 담당(나)이 할 일
- [x] User 테이블은 참조만 (생성/수정 안 함)
- [x] JWT access token 검증만 (발급/갱신 안 함)
- [x] §2-2 `WsJwtGuard` 신설 + `chat.gateway.ts` 보안 패치
- [x] 채팅 모듈 전체 CRUD

---

## 5. 통합 시점 체크리스트

1. **JWT_SECRET 동기화 확인** — `.env`에 동일 값
2. **JWT_REFRESH_SECRET 동기화 확인** — `.env`에 별도 값
3. **Payload 구조 확인** — `auth.service.ts:64`의 sign payload가 `{sub, email}`인지
4. **fallback_secret 제거 확인** — §2-1 적용됐는지
5. **WsJwtGuard 동작 확인** — 토큰 없이 ws 연결 시 거부되는지
6. **refresh 엔드포인트 동작 확인** — 만료 access token으로 401 → refresh 호출 → 새 토큰 → 재시도 흐름

---

## 6. 답변이 필요한 질문 (인증 담당자에게)

1. **§2-1 폴백 제거** 작업 일정 — 운영 배포 전 필수. 언제까지 가능?
2. **payload 구조** `{sub, email}` 그대로 유지하는 거 맞는가? 변경 계획 있으면 미리 공유 부탁
3. **refresh token 시스템** 구현 일정 — Phase A에 도입하기로 결정. 언제까지 가능?
4. **HS256 알고리즘** 그대로 사용? (passport-jwt 디폴트, 변경 계획 없으면 답변 불필요)

답변 받는 즉시 위 합의 내용 따라 DM 모듈 통합 작업 진행하겠습니다.