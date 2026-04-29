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

### 기획서 기반 핵심 기능

1. **인증 시스템**: `.ac.kr` 메일 인증으로 검증된 사용자만 이용
2. **기획서 시스템**: 팀 등록 시 정형화된 기획서 작성. **필수 공개 / 선택 공개** 2단계로 나누어 아이디어 재산권 보호
3. **구인/지원 시스템**: 스킬·직군·학교 등 조건별 세분화 검색, 서비스 내 채팅 + 대면 만남(커피 기프티콘 등) 지원
4. **프로필/포트폴리오 시스템**: 활동 유형별 카드형 포트폴리오, 대화형 작성 프레임워크, 도메인 태그

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
| 실시간 | socket.io-client 4.8 |
| 언어 | TypeScript 5.9 (strict) |
| ESLint | flat config (`eslint.config.mjs`) |

### Backend (`@mocozi/backend`)
| 항목 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| ORM | Prisma 6.16+ |
| DB | PostgreSQL 17 |
| 인증 | @nestjs/jwt + passport-jwt |
| 비밀번호 | bcrypt 6 |
| 실시간 | @nestjs/websockets + socket.io 4.8 |
| 검증 | class-validator + class-transformer |
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
│   └── PULL_REQUEST_TEMPLATE.md          # PR 작성 템플릿
├── .gitattributes                         # 줄바꿈 LF 통일
├── .gitignore                             # node_modules, .env, dist, .next 등 제외
├── .nvmrc                                 # Node 24.15.0
├── .prettierrc                            # 코드 포맷팅 규칙
├── docker-compose.yml                     # frontend / backend / db 3개 서비스 정의
├── README.md                              # 프로젝트 소개 + 빠른 시작
├── CLAUDE.md                              # (이 문서) 프로젝트 전반 컨텍스트
│
├── shared/                                # @mocozi/shared
│   ├── package.json
│   ├── index.ts                           # 모든 타입/상수 진입점
│   ├── types/
│   │   ├── user.ts                        # User, UserProfile
│   │   ├── team.ts                        # Team, TeamProposal (필수/선택공개)
│   │   ├── recruit.ts                     # RecruitPost, Application
│   │   ├── portfolio.ts                   # Portfolio, PortfolioItem
│   │   └── chat.ts                        # ChatRoom, ChatMessage
│   └── constants/
│       ├── roles.ts                       # 직군 enum (FRONTEND ~ OTHER)
│       └── skills.ts                      # 기술 스택 배열 (60+개)
│
├── frontend/                              # @mocozi/frontend (Next.js)
│   ├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
│   ├── tsconfig.json
│   ├── next.config.ts                     # transpilePackages: ['@mocozi/shared']
│   ├── postcss.config.mjs                 # Tailwind v4 PostCSS
│   ├── eslint.config.mjs
│   ├── next-env.d.ts                      # (자동 생성)
│   ├── Dockerfile.dev
│   ├── public/
│   └── src/
│       ├── styles/globals.css             # Tailwind 디렉티브 + 컴포넌트 클래스
│       ├── app/                           # App Router
│       │   ├── layout.tsx                 # 루트 레이아웃 (Header/Footer)
│       │   ├── page.tsx                   # 랜딩
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   ├── register/page.tsx      # .ac.kr 안내
│       │   │   └── verify-email/page.tsx
│       │   ├── recruit/
│       │   │   ├── page.tsx               # 리스트 (필터/검색)
│       │   │   └── [id]/page.tsx          # 상세 + 지원
│       │   ├── team/
│       │   │   ├── page.tsx               # 리스트
│       │   │   ├── create/page.tsx        # 팀 + 기획서 작성
│       │   │   └── [id]/page.tsx          # 상세
│       │   ├── profile/
│       │   │   ├── page.tsx               # 내 프로필 + 포트폴리오 카드
│       │   │   └── [id]/page.tsx          # 타인 프로필
│       │   └── chat/
│       │       ├── page.tsx               # 방 리스트
│       │       └── [roomId]/page.tsx      # 채팅방
│       ├── components/
│       │   ├── layout/{Header,Footer,Sidebar}.tsx
│       │   └── {ui,recruit,team,profile,chat}/  # 도메인별 컴포넌트 폴더
│       ├── hooks/
│       │   ├── useAuth.ts                 # 로그인/로그아웃 상태
│       │   └── useSocket.ts               # Socket.IO 연결
│       └── lib/
│           ├── api.ts                     # axios + JWT 인터셉터
│           └── utils.ts                   # formatDate, truncateText, timeAgo
│
└── backend/                               # @mocozi/backend (NestJS)
    ├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
    ├── .npmrc                             # node-linker=hoisted (Docker 호환)
    ├── tsconfig.json / nest-cli.json / eslint.config.mjs
    ├── .env.example
    ├── Dockerfile.dev                     # 시작 시 prisma db push 자동
    ├── prisma/
    │   └── schema.prisma                  # 전체 DB 스키마
    └── src/
        ├── main.ts                        # CORS, ValidationPipe, /api 프리픽스
        ├── app.module.ts                  # 루트 모듈 (모든 모듈 통합)
        ├── prisma/                        # 전역 Prisma 모듈
        │   ├── prisma.module.ts
        │   └── prisma.service.ts
        ├── auth/                          # 인증
        │   ├── auth.{module,controller,service}.ts
        │   ├── strategies/jwt.strategy.ts
        │   ├── guards/jwt-auth.guard.ts
        │   └── dto/{register,login}.dto.ts
        ├── user/                          # 프로필 조회·수정
        │   ├── user.{module,controller,service}.ts
        │   └── dto/update-profile.dto.ts
        ├── portfolio/                     # 포트폴리오 카드 CRUD
        │   ├── portfolio.{module,controller,service}.ts
        │   └── dto/{create,update}-portfolio.dto.ts
        ├── team/                          # 팀 + 기획서
        │   ├── team.{module,controller,service}.ts
        │   └── dto/{create-team,create-proposal}.dto.ts
        ├── recruit/                       # 구인 + 지원
        │   ├── recruit.{module,controller,service}.ts
        │   └── dto/{create-recruit,apply-recruit}.dto.ts
        ├── chat/                          # 실시간 채팅
        │   ├── chat.{module,gateway,service}.ts
        │   └── dto/send-message.dto.ts
        ├── search/                        # 통합 검색
        │   └── search.{module,controller,service}.ts
        └── common/                        # 전역 적용
            ├── filters/http-exception.filter.ts
            ├── interceptors/transform.interceptor.ts
            └── decorators/current-user.decorator.ts
```

---

## 4. 기능 ↔ 파일 매핑

### 4.1 인증 (.ac.kr 메일 인증)
| 단계 | 위치 |
|------|------|
| 회원가입 폼 | `frontend/src/app/(auth)/register/page.tsx` |
| 회원가입 API | `backend/src/auth/auth.controller.ts` `POST /api/auth/register` |
| `.ac.kr` 검증 | `backend/src/auth/auth.service.ts` |
| DB 모델 | `backend/prisma/schema.prisma` `User.emailVerified`, `verificationToken` |
| 인증 메일 페이지 | `frontend/src/app/(auth)/verify-email/page.tsx` |
| JWT 전략·가드 | `backend/src/auth/strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts` |
| 클라이언트 토큰 | `frontend/src/hooks/useAuth.ts`, `frontend/src/lib/api.ts` |

### 4.2 기획서 시스템 (필수/선택 공개)
| 단계 | 위치 |
|------|------|
| 작성 폼 | `frontend/src/app/team/create/page.tsx` |
| 작성 API | `backend/src/team/team.controller.ts` `POST /api/teams/:id/proposal` |
| 비즈니스 로직 | `backend/src/team/team.service.ts` |
| DTO (필수/선택 분리) | `backend/src/team/dto/create-proposal.dto.ts` |
| DB 모델 | `backend/prisma/schema.prisma` `TeamProposal` |
| 공유 타입 | `shared/types/team.ts` `TeamProposal`, `RequiredPublicInfo`, `OptionalPublicInfo` |

### 4.3 구인/지원
| 단계 | 위치 |
|------|------|
| 구인 리스트 | `frontend/src/app/recruit/page.tsx` |
| 구인 상세 + 지원 | `frontend/src/app/recruit/[id]/page.tsx` |
| 구인 API | `backend/src/recruit/recruit.controller.ts` |
| 통합 검색 | `backend/src/search/search.service.ts` (skill/role/university 필터) |
| DB 모델 | `RecruitPost`, `Application` |

### 4.4 프로필 / 포트폴리오 (카드형)
| 단계 | 위치 |
|------|------|
| 내 프로필 | `frontend/src/app/profile/page.tsx` |
| 타인 프로필 | `frontend/src/app/profile/[id]/page.tsx` |
| 프로필 API | `backend/src/user/user.controller.ts` |
| 포트폴리오 CRUD | `backend/src/portfolio/portfolio.controller.ts` |
| 카드 type enum | `shared/types/portfolio.ts` `PortfolioItemType` (project/research/activity/etc) |
| 도메인 태그 | DB `PortfolioItem.tags`, `domain` |

### 4.5 실시간 채팅
| 단계 | 위치 |
|------|------|
| 채팅방 리스트 | `frontend/src/app/chat/page.tsx` |
| 채팅방 화면 | `frontend/src/app/chat/[roomId]/page.tsx` |
| Socket 클라이언트 | `frontend/src/hooks/useSocket.ts` |
| WebSocket 게이트웨이 | `backend/src/chat/chat.gateway.ts` |
| 메시지 저장 | `backend/src/chat/chat.service.ts` |
| DB 모델 | `ChatRoom`, `ChatRoomUser`, `ChatMessage` |

---

## 5. DB 스키마 요약

`backend/prisma/schema.prisma`에 정의된 주요 모델:

| 모델 | 역할 |
|------|------|
| `User` | 사용자 + 대학 메일 인증 상태 (`emailVerified`, `verificationToken`) |
| `Team` / `TeamMember` | 팀과 멤버 관계 |
| `TeamProposal` | 기획서 (필수/선택 공개 정보 분리 저장) |
| `RecruitPost` / `Application` | 구인 게시글 + 지원 (중복 지원 방지 unique index) |
| `Portfolio` / `PortfolioItem` | 포트폴리오 + 카드 (type enum: PROJECT/RESEARCH/ACTIVITY/ETC) |
| `ChatRoom` / `ChatRoomUser` / `ChatMessage` | 다대다 채팅방 + 메시지 |

스키마 변경 후:
- **Docker 모드**: `docker compose restart backend` (시작 시 `prisma db push` 자동)
- **호스트 모드**: `cd backend && pnpm prisma db push`

---

## 6. 환경 변수

### `backend/.env` (각자 생성, gitignored)

`.env.example`을 복사해서 사용:
```bash
cp backend/.env.example backend/.env
```

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 접속 URL | docker 환경: `db:5432` / 호스트: `localhost:5432` |
| `JWT_SECRET` | JWT 서명 시크릿 | 운영 시 반드시 강한 값으로 |
| `SMTP_*` | 메일 발송 (인증) | 추후 실제 값으로 |
| `FRONTEND_URL` | CORS 허용 도메인 | `http://localhost:3000` |
| `PORT` | 백엔드 포트 | `8080` |

### Frontend (docker-compose에서 environment로 주입)
| 변수 | 값 |
|------|-----|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:8080` |

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
| localhost:5432 | PostgreSQL (`mocozi` / `mocozi_db`) |

### 7.2 호스트 직접 모드 (선택, 빠른 핫리로드)

```bash
docker compose up db -d                # DB만

cd backend && pnpm install
cd ../frontend && pnpm install

cd backend && pnpm start:dev           # 터미널 1
cd frontend && pnpm dev                # 터미널 2
```

> 호스트 모드 시 `backend/.env`의 `DATABASE_URL` 호스트를 `localhost`로 변경 필요

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

- **커밋 메시지**: `<type>: <한글 설명>` (예: `feat: 회원가입 폼 추가`, `fix: 메일 검증 정규식 버그`)
  - 타입: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`
- **PR 생성 시**: `.github/PULL_REQUEST_TEMPLATE.md` 자동 적용
- **포맷팅**: `.prettierrc` 기준 (singleQuote, trailingComma all, tabWidth 2, printWidth 80)
  - VS Code Prettier 확장 + 저장 시 자동 포맷 권장
- **린트**: PR 전 `pnpm lint` 통과 확인
- **DB 스키마 변경**: PR 본문에 변경 의도 명시
- **`backend/.env`** 절대 commit 금지 (`.gitignore`로 보호되지만 항상 확인)

---

## 11. 향후 작업 / TODO

- [ ] CI/CD (GitHub Actions) — 락 파일 셋업 마무리 후 재추가 예정
- [ ] SMTP 메일 발송 실제 연동 (현재는 인증 토큰 발급까지만)
- [ ] 프론트엔드 페이지의 실제 데이터 연동 (현재 플레이스홀더)
- [ ] shared 타입을 frontend/backend 코드에서 실사용 (현재 정의만 있고 import 미사용)
- [ ] 통합 테스트 / E2E 테스트
- [ ] README의 팀원 정보 채우기

---

## 12. 트러블슈팅 (자주 마주치는 이슈)

| 증상 | 해결 |
|------|------|
| `Cannot connect to the Docker daemon` | Docker Desktop 실행 확인 |
| `port is already allocated` | 3000/8080 포트 점유 프로세스 종료 |
| `nvm use` 안 됨 (Windows) | 관리자 권한 PowerShell, 또는 Node 24.15.0 직접 설치 |
| 코드 수정 반영 안 됨 | `docker compose restart <service>` |
| Prisma 스키마 변경 미반영 | `docker compose restart backend` (db push 자동 실행) |
| 처음부터 깨끗하게 | `docker compose down -v && docker compose up --build` ⚠️ DB 데이터 삭제 |
| `bcrypt` 호스트 설치 실패 (Windows) | Visual Studio Build Tools + Python 설치 또는 Docker 모드 사용 |
