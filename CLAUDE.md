# 모코지 (Mocozi) 프로젝트 컨텍스트

> 이 문서는 프로젝트 전반의 구조·기능·환경 정보를 담은 단일 진입점입니다.
> 신규 팀원 온보딩 및 AI 어시스턴트(Claude Code 등)가 컨텍스트로 사용합니다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 모코지 (Mocozi) |
| 한 줄 소개 | IT계열 대학생을 위한 프로젝트/해커톤/스터디 구인 및 네트워킹 플랫폼 |
| 핵심 차별점 | 대학교 메일(`.ac.kr`) 인증 + 정형화된 기획서 시스템 + 카드형 포트폴리오 |
| 레포 | https://github.com/next-mocozi/mocozi |
| 프론트 배포 | Vercel |
| 백엔드 배포 | Railway |

### 기획서 기반 핵심 기능

1. **인증 시스템**: `.ac.kr` 메일 인증으로 검증된 사용자만 이용
2. **기획서 시스템**: 팀 등록 시 정형화된 기획서 작성. **필수 공개 / 선택 공개** 2단계로 나누어 아이디어 재산권 보호
3. **구인/지원 시스템**: 스킬·직군·학교 등 조건별 세분화 검색, 서비스 내 채팅 + 대면 만남(커피 기프티콘 등) 지원
4. **프로필/포트폴리오 시스템**: 활동 유형별 카드형 포트폴리오, 대화형 작성 프레임워크, 도메인 태그
5. **알림 시스템**: 지원 수락/거절, 팀원 추방 등 주요 이벤트 WebSocket 실시간 알림

---

## 2. 기술 스택

### 런타임 / 패키지
| 항목 | 버전 |
|------|------|
| Node.js (`.nvmrc`) | **24.15.0** |
| 패키지 매니저 | **pnpm 10.33.2** |
| 컨테이너 | Docker, Docker Compose |

### Frontend (`@mocozi/frontend`)
| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| UI | React 19 |
| 스타일 | Tailwind CSS 4 (CSS-first config) |
| HTTP | axios 1.15 |
| 서버 상태 | SWR 2.4 |
| 실시간 | socket.io-client 4.8 |
| 마크다운 | react-markdown 10 + remark-gfm + remark-math + rehype-katex + rehype-sanitize |
| 언어 | TypeScript 5.9 (strict) |
| ESLint | flat config (`eslint.config.mjs`) |

### Backend (`@mocozi/backend`)
| 항목 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| ORM | Prisma 6.16+ |
| DB | **Supabase** (PostgreSQL 17 managed) — 로컬 `db` 컨테이너는 docker-compose healthcheck 용도로만 존재 |
| 인증 | @nestjs/jwt + passport-jwt |
| 비밀번호 | bcrypt 6 |
| 실시간 | @nestjs/websockets + socket.io 4.8 |
| 검증 | class-validator + class-transformer |
| 메일 발송 | Resend 4.6 |
| 스토리지 | @supabase/supabase-js 2 (파일 첨부) |
| 언어 | TypeScript 5.9 (strict, `strictPropertyInitialization` off) |

### Shared (`@mocozi/shared`)
- TypeScript 타입 / 상수만 노출하는 워크스페이스 패키지
- 진입점: `shared/index.ts`
- frontend·backend 양쪽에서 `@mocozi/shared` 로 import

---

## 3. 디렉토리 구조

```
mocozi/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md
├── docker-compose.yml                     # frontend / backend / db 3개 서비스
├── CLAUDE.md                              # (이 문서)
│
├── shared/                                # @mocozi/shared
│   ├── index.ts                           # 모든 타입/상수 진입점
│   ├── types/
│   │   ├── user.ts                        # User, UserProfile, RepresentativeActivity
│   │   ├── team.ts                        # Team, TeamProposal (필수/선택 공개)
│   │   ├── recruit.ts                     # RecruitPost, Application
│   │   ├── portfolio.ts                   # Portfolio, PortfolioItem, PortfolioItemType
│   │   └── chat.ts                        # ChatRoom, ChatMessage
│   └── constants/
│       ├── roles.ts                       # 직군 enum
│       └── skills.ts                      # 기술 스택 배열 (60+개)
│
├── frontend/                              # @mocozi/frontend (Next.js)
│   └── src/
│       ├── styles/globals.css             # Tailwind 디렉티브 + 컴포넌트 클래스
│       ├── providers/
│       │   └── SocketProvider.tsx         # Socket.IO Context + useChatNotifications 훅
│       ├── app/                           # App Router
│       │   ├── layout.tsx                 # 루트 레이아웃 (Header/Footer + SocketProvider)
│       │   ├── page.tsx                   # 랜딩
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   ├── register/page.tsx      # .ac.kr 안내, 중복 제출 방지
│       │   │   └── verify-email/page.tsx
│       │   ├── team/
│       │   │   ├── page.tsx               # 리스트 (필터/검색/페이지네이션)
│       │   │   ├── create/page.tsx        # 팀 + 기획서 작성
│       │   │   └── [id]/
│       │   │       ├── page.tsx           # 팀 상세
│       │   │       ├── edit/page.tsx      # 팀 수정 + 삭제
│       │   │       └── applications/page.tsx  # 지원자 관리 (수락/거절/추방)
│       │   ├── recruit/
│       │   │   ├── page.tsx               # 구인 리스트 (필터/검색)
│       │   │   └── [id]/page.tsx          # 구인 상세 + 지원
│       │   ├── profile/
│       │   │   ├── page.tsx               # 내 프로필
│       │   │   ├── [id]/page.tsx          # 타인 프로필 (profileSections 기반 탭)
│       │   │   ├── edit/page.tsx          # 프로필 편집
│       │   │   ├── edit/templates/page.tsx  # 메시지 양식 관리
│       │   │   └── _platforms.tsx         # 플랫폼 링크 컴포넌트
│       │   ├── portfolio/
│       │   │   ├── page.tsx               # 포트폴리오 피드 (전체)
│       │   │   ├── me/page.tsx            # 내 포트폴리오
│       │   │   ├── [userId]/page.tsx      # 타인 포트폴리오
│       │   │   ├── [userId]/items/[itemId]/page.tsx  # 아이템 상세
│       │   │   ├── edit/page.tsx          # 포트폴리오 편집
│       │   │   ├── onboarding/page.tsx    # 포트폴리오 온보딩
│       │   │   ├── _ItemFullView.tsx      # 아이템 전체 보기
│       │   │   ├── _platforms.tsx         # 플랫폼 링크 컴포넌트
│       │   │   └── _lib.tsx               # 포트폴리오 유틸
│       │   ├── chat/
│       │   │   ├── page.tsx               # 채팅방 리스트
│       │   │   └── [roomId]/page.tsx      # 채팅방 (Markdown 렌더링, 첨부파일)
│       │   ├── notifications/
│       │   │   └── page.tsx               # 알림 센터 (모바일용 풀페이지)
│       │   └── community/
│       │       └── page.tsx               # 커뮤니티 (구현 진행 중)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.tsx             # 네비게이션 (hasStoredToken useEffect 패턴)
│       │   │   ├── Footer.tsx
│       │   │   ├── NotificationCenter.tsx # 알림 드롭다운 (데스크톱)
│       │   │   └── AlertModal.tsx
│       │   ├── icons/
│       │   │   ├── CommonIcons.tsx
│       │   │   ├── ChatIcons.tsx
│       │   │   ├── NotificationIcon.tsx
│       │   │   └── PreviewIcon.tsx
│       │   ├── chat/
│       │   │   ├── RoomList.tsx / RoomPreviewPanel.tsx
│       │   │   ├── NewChatModal.tsx / ScoutModal.tsx
│       │   │   ├── SlidingPanel.tsx
│       │   │   ├── MessageMarkdown.tsx    # 채팅 마크다운 렌더러
│       │   │   ├── TemplateTrigger.tsx / TemplatePreview.tsx
│       │   │   ├── AttachmentButton.tsx / AttachmentPicker.tsx
│       │   │   ├── FileAttachmentCard.tsx / ImageAttachment.tsx
│       │   │   └── ToastContainer.tsx / RoleSelector.tsx
│       │   ├── portfolio/
│       │   │   ├── PortfolioSegmentedNav.tsx
│       │   │   ├── FeedDetailPanel.tsx
│       │   │   └── FeedPostCard.tsx
│       │   ├── landing/
│       │   │   ├── HowItWorks.tsx
│       │   │   └── PeerDirectory.tsx
│       │   └── ui/
│       │       └── Pagination.tsx
│       ├── hooks/
│       │   ├── useAuth.ts                 # 로그인/로그아웃 상태
│       │   ├── useSocket.ts               # Socket.IO 연결
│       │   ├── usePagination.ts           # 페이지네이션 유틸
│       │   ├── useNotifications.ts        # 알림 WebSocket 수신 + 상태
│       │   ├── useNotificationFeed.ts     # 알림 피드 SWR
│       │   ├── useFeed.ts                 # 포트폴리오 피드 SWR
│       │   ├── useMyPortfolio.ts          # 내 포트폴리오 SWR 캐시
│       │   └── useMyPortfolioStatus.ts    # 포트폴리오 상태 조회
│       └── lib/
│           ├── api.ts                     # axios + JWT 인터셉터
│           ├── authApi.ts                 # 인증 API 함수
│           ├── portfolio-api.ts           # 포트폴리오 API 함수
│           ├── portfolio-mapper.ts        # 백엔드 → 프론트 데이터 변환
│           ├── messageTemplate.ts         # 메시지 양식 관리
│           ├── universities.ts            # 대학 데이터
│           ├── utils.ts                   # 범용 유틸
│           ├── timeAgo.ts                 # 상대 시간 포맷
│           ├── chat/
│           │   ├── signAttachmentUrls.ts  # 첨부파일 URL 서명
│           │   ├── attachmentUpload.ts    # 파일 업로드
│           │   └── emptyRoomGuard.ts      # 빈 채팅방 가드
│           └── feed/
│               ├── buildBackendFeed.ts
│               ├── buildOwnerFeed.ts
│               └── types.ts
│
└── backend/                               # @mocozi/backend (NestJS)
    ├── .env.example
    ├── Dockerfile.dev
    ├── prisma/
    │   └── schema.prisma                  # 전체 DB 스키마
    └── src/
        ├── main.ts                        # CORS, ValidationPipe, /api 프리픽스
        ├── app.module.ts
        ├── prisma/                        # 전역 Prisma 모듈
        ├── auth/                          # 인증
        │   ├── auth.{module,controller,service}.ts
        │   ├── strategies/{jwt,ws-jwt}.strategy.ts
        │   ├── guards/{jwt-auth,ws-jwt}.guard.ts
        │   └── dto/{register,login,resend-verification}.dto.ts
        ├── user/                          # 프로필 조회·수정
        │   ├── user.{module,controller,service}.ts
        │   └── dto/update-profile.dto.ts
        ├── portfolio/                     # 포트폴리오 CRUD
        │   ├── portfolio.{module,controller,service}.ts
        │   └── dto/{create,update}-portfolio*.dto.ts
        │       {work-experience,external-activity,portfolio-link,update-portfolio-meta}.dto.ts
        ├── team/                          # 팀 + 기획서
        │   ├── team.{module,controller,service}.ts
        │   ├── proposal.controller.ts
        │   └── dto/{create-team,create-proposal,update-proposal,update-visibility}.dto.ts
        ├── apply/                         # 구인 + 지원 (recruit 모듈에서 분리)
        │   ├── apply.{module,controller,service}.ts
        │   └── dto/apply.dto.ts
        ├── notification/                  # 알림 시스템
        │   ├── notification.{module,controller,service}.ts
        │   └── notification.gateway.ts    # Socket emit 전담 (`user:<id>` room)
        ├── chat/                          # 실시간 채팅
        │   ├── chat.{module,controller,gateway,service}.ts
        │   ├── storage.service.ts         # Supabase Storage 첨부파일
        │   └── dto/{send-message,list-messages,list-rooms,create-room,
        │           mark-as-read,edit-message,add-reaction,attachment}.dto.ts
        ├── search/                        # 통합 검색
        │   └── search.{module,controller,service}.ts
        ├── template/                      # 채팅 메시지 양식 CRUD
        │   ├── template.{module,controller,service}.ts
        │   └── dto/upsert-template.dto.ts
        └── common/
            ├── decorators/current-user.decorator.ts
            ├── filters/{http-exception,ws-exception}.filter.ts
            └── interceptors/transform.interceptor.ts
```

---

## 4. 기능 ↔ 파일 매핑

### 4.1 인증 (.ac.kr 메일 인증)
| 단계 | 위치 |
|------|------|
| 회원가입 폼 | `frontend/src/app/(auth)/register/page.tsx` (중복 제출 방지: `isSubmitting` state) |
| 회원가입 API | `backend/src/auth/auth.controller.ts` `POST /api/auth/register` |
| `.ac.kr` 검증 | `backend/src/auth/auth.service.ts` |
| 메일 발송 | `backend/src/auth/auth.service.ts` — Resend SDK 사용 |
| DB 모델 | `User.emailVerified`, `verificationToken` |
| 인증 메일 페이지 | `frontend/src/app/(auth)/verify-email/page.tsx` |
| JWT 전략·가드 | `backend/src/auth/strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts` |
| WS 인증 가드 | `backend/src/auth/guards/ws-jwt.guard.ts` |
| 클라이언트 토큰 | `frontend/src/hooks/useAuth.ts`, `frontend/src/lib/api.ts` |

### 4.2 기획서 시스템 (필수/선택 공개)
| 단계 | 위치 |
|------|------|
| 작성 폼 | `frontend/src/app/team/create/page.tsx` |
| 수정 폼 | `frontend/src/app/team/[id]/edit/page.tsx` |
| 작성 API | `backend/src/team/proposal.controller.ts` |
| 비즈니스 로직 | `backend/src/team/team.service.ts` |
| DB 모델 | `TeamProposal` (recruitingRoles, requiredSkills 포함) |
| 공유 타입 | `shared/types/team.ts` `TeamProposal`, `RequiredPublicInfo`, `OptionalPublicInfo` |

### 4.3 구인/지원
| 단계 | 위치 |
|------|------|
| 구인 리스트 | `frontend/src/app/recruit/page.tsx` |
| 구인 상세 + 지원 | `frontend/src/app/recruit/[id]/page.tsx` |
| 지원 API | `backend/src/apply/apply.controller.ts` |
| 지원자 관리 | `frontend/src/app/team/[id]/applications/page.tsx` |
| 통합 검색 | `backend/src/search/search.service.ts` |
| DB 모델 | `RecruitPost`, `Application` (ApplicationStatus: PENDING/ACCEPTED/REJECTED) |

### 4.4 프로필 / 포트폴리오 (카드형)
| 단계 | 위치 |
|------|------|
| 내 프로필 | `frontend/src/app/profile/page.tsx` |
| 타인 프로필 | `frontend/src/app/profile/[id]/page.tsx` (profileSections로 탭 구성) |
| 프로필 편집 | `frontend/src/app/profile/edit/page.tsx` |
| 포트폴리오 피드 | `frontend/src/app/portfolio/page.tsx` |
| 내 포트폴리오 | `frontend/src/app/portfolio/me/page.tsx` |
| 타인 포트폴리오 | `frontend/src/app/portfolio/[userId]/page.tsx` |
| 포트폴리오 편집 | `frontend/src/app/portfolio/edit/page.tsx` |
| 프로필 API | `backend/src/user/user.controller.ts` |
| 포트폴리오 CRUD | `backend/src/portfolio/portfolio.controller.ts` |
| 섹션 순서 저장 | `Portfolio.profileSections String[]` — DB 저장으로 타인 뷰 동기화 |
| DB 모델 | `Portfolio`, `PortfolioItem`, `PortfolioWorkExperience`, `PortfolioExternalActivity`, `PortfolioLink` |

### 4.5 실시간 채팅
| 단계 | 위치 |
|------|------|
| 채팅방 리스트 | `frontend/src/app/chat/page.tsx` |
| 채팅방 화면 | `frontend/src/app/chat/[roomId]/page.tsx` |
| Socket Context | `frontend/src/providers/SocketProvider.tsx` (`useChatNotifications` 훅 포함) |
| Socket 훅 | `frontend/src/hooks/useSocket.ts` |
| WebSocket 게이트웨이 | `backend/src/chat/chat.gateway.ts` |
| 파일 업로드 | `backend/src/chat/storage.service.ts` (Supabase Storage) |
| DB 모델 | `ChatRoom` (type: DM/GROUP/CHANNEL), `ChatRoomMember`, `ChatMessage`, `MessageReaction` |
| 메시지 양식 | `backend/src/template/`, `UserMessageTemplate` (context: RECRUIT_INDIVIDUAL 등) |

> **관련 정책 / 설계 문서**: [`docs/chat/`](./docs/chat/) — 진입점 [`00-overview.md`](./docs/chat/00-overview.md).

### 4.6 알림 시스템
| 단계 | 위치 |
|------|------|
| 알림 페이지 (모바일) | `frontend/src/app/notifications/page.tsx` |
| 알림 드롭다운 (데스크톱) | `frontend/src/components/layout/NotificationCenter.tsx` |
| 알림 훅 | `frontend/src/hooks/useNotifications.ts`, `useNotificationFeed.ts` |
| 알림 API | `backend/src/notification/notification.controller.ts` |
| Socket emit | `backend/src/notification/notification.gateway.ts` (`user:<id>` room) |
| DB 모델 | `Notification` (type: APPLICATION_RECEIVED, APPLICATION_PROCESSED, TEAM_MEMBER_KICKED 등) |
| 트리거 | 지원 수락/거절, 팀원 추방 시 `notification.service.ts`에서 발송 |

---

## 5. DB 스키마 요약

`backend/prisma/schema.prisma`에 정의된 주요 모델:

| 모델 | 역할 |
|------|------|
| `User` | 사용자 + 대학 메일 인증 (`emailVerified`, `verificationToken`) |
| `Team` / `TeamMember` | 팀과 멤버 관계 (OWNER/MEMBER/KICKED 상태) |
| `TeamProposal` | 기획서 (필수/선택 공개 분리, recruitingRoles, requiredSkills) |
| `RecruitPost` / `Application` | 구인 게시글 + 지원 (중복 지원 방지 unique index) |
| `Portfolio` | 포트폴리오 메타 (`profileSections String[]` — 섹션 표시 순서) |
| `PortfolioItem` | 포트폴리오 카드 (type: PROJECT/RESEARCH/STUDY/ACTIVITY/ETC) |
| `PortfolioWorkExperience` | 실무 경험 (기간, 회사명, 역할 등) |
| `PortfolioExternalActivity` | 대외 활동 |
| `PortfolioLink` | 포트폴리오 외부 링크 |
| `ChatRoom` / `ChatRoomMember` / `ChatMessage` | 다대다 채팅방 (type: DM/GROUP/CHANNEL) |
| `MessageReaction` | 메시지 이모지 반응 |
| `UserMessageTemplate` | 컨텍스트별 채팅 첫 메시지 양식 |
| `Notification` | 알림 (type enum, isRead, 발신자/수신자 관계) |

### 스키마 변경 절차

로컬 Docker 환경:
```bash
docker exec mocozi-temp-backend-1 sh -c "cd /app && pnpm exec prisma db push"
docker compose restart backend
```

프로덕션 (Railway 배포 중):
- `backend/prisma/migrations/*.sql` 내용을 Supabase SQL Editor에서 수동 실행
- 또는 `ALTER TABLE` 직접 실행 후 Railway에서 backend 재배포

> `prisma db push`는 Supabase pooler 연결 한도 초과로 **자동 실행 안 함**

---

## 6. 환경 변수

### `backend/.env` (각자 생성, gitignored)

```bash
cp backend/.env.example backend/.env
```

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | Supabase 커넥션 풀러 URL (transaction mode, 포트 6543 + `pgbouncer=true`) |
| `DIRECT_URL` | Supabase session mode URL (포트 5432, `prisma db push` 전용) |
| `JWT_SECRET` | JWT 서명 시크릿 |
| `RESEND_API_KEY` | Resend 메일 발송 API 키 |
| `SUPABASE_URL` | Supabase 프로젝트 URL (스토리지 업로드용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role 키 |
| `FRONTEND_URL` | CORS 허용 도메인 (`http://localhost:3000`) |
| `PORT` | 백엔드 포트 (`8080`) |

### Frontend (docker-compose / Vercel 환경 변수)
| 변수 | 값 |
|------|-----|
| `NEXT_PUBLIC_API_URL` | 로컬: `http://localhost:8080` / 프로덕션: Railway URL |
| `NEXT_PUBLIC_SOCKET_URL` | 로컬: `http://localhost:8080` / 프로덕션: Railway URL |

---

## 7. 개발 환경

### 7.1 Docker 모드 (기본)

```bash
docker compose up                # 첫 실행 5~10분, 이후 수십 초
docker compose up -d             # 백그라운드
docker compose stop              # 정지 (보존)
docker compose start             # 재시작 (가장 빠름)
docker compose down              # 컨테이너 제거
docker compose down -v           # ⚠️ DB 데이터까지 제거
docker compose logs -f backend   # 백엔드 실시간 로그
docker compose ps                # 상태 확인
docker compose restart backend   # 스키마 변경 후 backend만 재시작
```

| URL | 서비스 |
|-----|--------|
| http://localhost:3000 | Frontend |
| http://localhost:8080/api | Backend API |
| localhost:5432 | 로컬 PostgreSQL 컨테이너 (healthcheck 용 — 실제 데이터는 Supabase) |

### 7.2 호스트 직접 모드 (선택, 빠른 핫리로드)

```bash
docker compose up db -d

cd backend && pnpm install
cd ../frontend && pnpm install

cd backend && pnpm start:dev           # 터미널 1
cd frontend && pnpm dev                # 터미널 2
```

> 호스트 모드 시 `backend/.env`의 `DATABASE_URL` 호스트를 `localhost`로 변경 필요

### 7.3 프로덕션 배포

| 서비스 | 플랫폼 | 비고 |
|--------|--------|------|
| Frontend | **Vercel** | `develop` → `main` 머지 시 자동 배포 |
| Backend | **Railway** | 수동 배포 또는 GitHub 연동 |
| DB | **Supabase** | PostgreSQL 17, 스키마 변경은 SQL Editor에서 수동 |

> Railway cold start로 WebSocket 첫 연결이 일시 실패하는 것은 정상 패턴

---

## 8. 주요 명령어

### Backend
```bash
pnpm start:dev        # nest watch
pnpm build            # 프로덕션 빌드
pnpm test             # Jest
pnpm lint             # ESLint
pnpm prisma:generate  # Prisma Client 재생성
pnpm prisma:migrate   # 마이그레이션 생성/적용
pnpm prisma:studio    # DB GUI (localhost:5555)
```

### Frontend
```bash
pnpm dev              # next dev
pnpm build            # 프로덕션 빌드
pnpm start            # 빌드 결과 실행
pnpm lint             # ESLint
pnpm type-check       # tsc --noEmit
```

---

## 9. 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 프로덕션 (보호 브랜치) |
| `develop` | 개발 통합 |
| `feature/<기능명>` | 기능 개발 |
| `hotfix/<이슈명>` | 긴급 수정 |

워크플로우: `develop`에서 `feature/xxx` 분기 → 작업 → `develop`으로 PR → 리뷰 → 머지 → 배포 시 `develop` → `main`

---

## 10. 코드 컨벤션 / 기여 가이드라인

- **커밋 메시지**: `<type>(<scope>): <한글 설명>` (예: `feat(team): 팀 삭제 기능 추가`, `fix(auth): 메일 재발송 경로 복구`)
  - 타입: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`
- **PR 생성 시**: `.github/PULL_REQUEST_TEMPLATE.md` 자동 적용
- **포맷팅**: `.prettierrc` 기준 (singleQuote, trailingComma all, tabWidth 2, printWidth 80)
- **린트**: PR 전 `pnpm lint` 통과 확인
- **DB 스키마 변경**: PR 본문에 변경 의도 명시 + 마이그레이션 SQL 첨부
- **`backend/.env`** 절대 commit 금지

### React Hydration 주의사항
- `localStorage` 접근은 반드시 `useEffect` 안에서 (`useState(false)` 초기값 패턴)
- 서버/클라이언트 불일치 시 React #418 에러 발생

---

## 11. 향후 작업 / TODO

- [ ] 커뮤니티 기능 구현 (`/community` 페이지 골격만 존재)
- [ ] shared 타입을 frontend/backend 코드에서 실사용 (현재 정의만 있고 import 미사용)
- [ ] 통합 테스트 / E2E 테스트
- [ ] README 팀원 정보 채우기

---

## 12. 트러블슈팅 (자주 마주치는 이슈)

| 증상 | 해결 |
|------|------|
| `Cannot connect to the Docker daemon` | Docker Desktop 실행 확인 |
| `port is already allocated` | 3000/8080 포트 점유 프로세스 종료 |
| `nvm use` 안 됨 (Windows) | 관리자 권한 PowerShell, 또는 Node 24.15.0 직접 설치 |
| 코드 수정 반영 안 됨 | `docker compose restart <service>` |
| Prisma 스키마 변경 미반영 | `docker exec mocozi-temp-backend-1 sh -c "cd /app && pnpm exec prisma db push"` 후 `docker compose restart backend` |
| 처음부터 깨끗하게 | `docker compose down -v && docker compose up --build` ⚠️ DB 데이터 삭제 |
| `bcrypt` 호스트 설치 실패 (Windows) | Visual Studio Build Tools + Python 설치 또는 Docker 모드 사용 |
| React Hydration 에러 #418 | `localStorage` 접근을 `useEffect` 밖에서 하면 발생 — `useState(false)` + `useEffect` 패턴 사용 |
| Railway WebSocket 일시 실패 | cold start 정상 패턴 — 잠시 후 자동 복구 |
| Vercel 빌드 TypeScript 에러 | `pnpm type-check` 로컬에서 먼저 확인 후 푸시 |
