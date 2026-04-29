# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

IT계열 대학생 팀 빌딩 플랫폼. 대학 메일(`.ac.kr`) 인증 기반 신뢰 네트워크를 제공한다.

## 개발 환경 실행

```bash
# Docker Compose로 전체 스택 실행 (권장)
docker-compose up

# 로컬 직접 실행 시 DATABASE_URL의 host를 db → localhost로 변경 필요
cd backend && pnpm install && pnpm start:dev   # :8080
cd frontend && pnpm install && pnpm dev        # :3000
docker-compose up db -d                        # PostgreSQL :5432
```

DB를 처음 실행하면 마이그레이션이 필요하다:
```bash
cd backend && pnpm prisma:migrate
```

## 주요 명령어

### Backend (`backend/`)
```bash
pnpm start:dev       # 개발 서버 (watch 모드)
pnpm build           # 프로덕션 빌드
pnpm lint            # ESLint 검사
pnpm lint:fix        # ESLint 자동 수정
pnpm type-check      # TypeScript 타입 체크 (컴파일 없이)
pnpm test            # Jest 단위 테스트
pnpm test:watch      # 감시 모드 테스트
pnpm test:cov        # 커버리지 포함 테스트
pnpm prisma:generate # Prisma 클라이언트 재생성 (schema 변경 후)
pnpm prisma:migrate  # 마이그레이션 적용
pnpm prisma:studio   # DB GUI 브라우저
```

### Frontend (`frontend/`)
```bash
pnpm dev         # 개발 서버
pnpm build       # 프로덕션 빌드
pnpm lint        # Next.js ESLint
pnpm type-check  # TypeScript 타입 체크
```

## 아키텍처

### 모노레포 구조
```
backend/   — Nest.js API 서버
frontend/  — Next.js App Router
shared/    — 양측이 import하는 TypeScript 타입 및 상수
```

`shared/`는 별도 패키지(`@mocozi/shared`)로 관리되며, `tsconfig.json`의 path alias `@shared/*`로 참조한다.

### Backend (Nest.js)

모든 API 경로에 `/api` 접두사가 붙는다 (`main.ts`에서 `setGlobalPrefix('api')`).

**모듈 구조**
- `prisma/` — `PrismaService` 싱글톤. DB 접근은 반드시 이 서비스를 통한다.
- `auth/` — 회원가입·로그인·이메일 인증. JWT 7일 만료. `.ac.kr` 메일만 허용.
- `user/` — 프로필 조회·수정
- `team/` — 팀 생성, 기획서 작성, 멤버 관리
- `recruit/` — 구인 게시글 CRUD, 지원 처리
- `portfolio/` — 포트폴리오 항목 CRUD
- `chat/` — Socket.IO WebSocket 게이트웨이 (`ChatGateway`), 메시지 저장
- `search/` — 스킬·직군·학교 조건별 검색

**공통 레이어** (`common/`)
- `TransformInterceptor` — 모든 응답을 `{ success: true, data: T, timestamp: string }` 형식으로 래핑
- `HttpExceptionFilter` — 에러 응답 표준화
- `@CurrentUser()` decorator — JWT에서 인증된 사용자 추출
- `JwtAuthGuard` — 라우트 보호. 인증이 필요한 컨트롤러/핸들러에 적용.

### Frontend (Next.js App Router)

**API 통신**: `src/lib/api.ts`의 Axios 인스턴스를 사용한다. JWT 토큰을 `localStorage('accessToken')`에 저장하고 요청마다 자동 첨부한다. 401 응답 시 토큰 삭제 후 `/login`으로 리다이렉트한다.

**실시간 채팅**: `src/hooks/useSocket.ts`로 Socket.IO 연결을 관리한다. 이벤트: `joinRoom`, `leaveRoom`, `sendMessage`.

**라우팅**
- `(auth)/` — 비인증 페이지 (로그인, 회원가입, 이메일 인증)
- `team/`, `recruit/`, `profile/`, `chat/` — 기능별 페이지

### 데이터베이스 (Prisma + PostgreSQL)

**핵심 관계**
- `User` → `Team` (1:N, 리더), `TeamMember` (N:M), `Portfolio` (1:1)
- `Team` → `TeamProposal` (1:1), `RecruitPost` (1:N)
- `RecruitPost` → `Application` (1:N)
- `ChatRoom` ↔ `User` (N:M via `ChatRoomUser`), `ChatMessage` (1:N)

**기획서 공개 범위**: `TeamProposal`의 필드 중 `detailedPlan`, `techStack`, `referenceLinks`, `detailedSchedule`, `expectedOutcome`은 선택 공개(지원자가 공개 요청 가능), 나머지는 필수 공개다.

`RecruitPost.visibility`에 `UNIVERSITY_ONLY` 옵션이 있어 같은 대학 사용자에게만 노출할 수 있다.

## 환경 변수

`backend/.env.example` 참조. Docker Compose 환경에서는 `DATABASE_URL`의 호스트가 `db`이고, 로컬 직접 실행 시 `localhost`로 변경해야 한다.
