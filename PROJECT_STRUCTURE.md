# 모코지 (Mocozi) 프로젝트 구조 문서

> 새로 합류한 팀원이 이 문서 하나로 프로젝트 전체를 이해할 수 있도록 정리한 가이드

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | 모코지 (Mocozi) |
| 한 줄 소개 | IT계열 대학생을 위한 프로젝트/해커톤/스터디 구인 및 네트워킹 플랫폼 |
| 핵심 차별점 | 대학교 메일(`.ac.kr`) 인증으로 검증된 사용자 + 정형화된 기획서 + 카드형 포트폴리오 |

### 핵심 기능 (기획서 기반)

1. **인증 시스템**: `.ac.kr` 메일 인증으로 검증된 사용자만 가입 가능
2. **기획서 시스템**: 팀 등록 시 정형화된 기획서 작성. **필수 공개 / 선택 공개 2단계**로 분리하여 아이디어 재산권 보호
3. **구인/지원 시스템**: 스킬·직군·학교 등 조건별 세분화 검색, 서비스 내 채팅 + 대면 만남(커피 기프티콘 등) 지원
4. **프로필/포트폴리오 시스템**: 활동 유형별 **카드형 포트폴리오**, 대화형 작성 프레임워크, 도메인 태그

---

## 2. 기술 스택

### 런타임 / 패키지
| 영역 | 기술 | 버전 |
|------|------|------|
| Node.js | `.nvmrc` 기준 | **24.15.0** |
| 패키지 매니저 | pnpm | **10.33.2** |
| 컨테이너 | Docker, Docker Compose | 최신 |

### Frontend
| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| UI | React 19 |
| 스타일 | Tailwind CSS 4 (CSS-first config) |
| HTTP | axios 1.15 |
| 실시간 | socket.io-client 4.8 |
| 언어 | TypeScript 5.9 (strict) |
| ESLint | flat config (`eslint.config.mjs`) |

### Backend
| 항목 | 기술 |
|------|------|
| 프레임워크 | NestJS 11 |
| ORM | Prisma 6.16+ |
| DB | PostgreSQL 17 |
| 인증 | @nestjs/jwt + @nestjs/passport (passport-jwt) |
| 비밀번호 해싱 | bcrypt 6 |
| 실시간 | @nestjs/websockets + socket.io 4.8 |
| 검증 | class-validator + class-transformer |
| 언어 | TypeScript 5.9 (strict, `strictPropertyInitialization` off) |

### Shared
| 항목 | 내용 |
|------|------|
| 형태 | TypeScript 타입/상수만 노출하는 워크스페이스 패키지 |
| 진입점 | `shared/index.ts` |
| 사용처 | frontend, backend 양쪽에서 `@mocozi/shared` 로 import |

---

## 3. 전체 디렉토리 구조

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
├── 2026_mocozi.docx                       # 기획서 (참고용)
│
├── docs/                                  # 프로젝트 문서
│   └── PROJECT_STRUCTURE.md               # (이 파일)
│
├── shared/                                # 공유 패키지 (@mocozi/shared)
│   ├── package.json
│   ├── index.ts                           # 모든 타입/상수의 진입점
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
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml                # 빌드 허용 패키지 정의
│   ├── tsconfig.json
│   ├── next.config.ts                     # Next 설정 (transpilePackages: shared)
│   ├── postcss.config.mjs                 # Tailwind v4 PostCSS
│   ├── eslint.config.mjs                  # ESLint flat config
│   ├── next-env.d.ts                      # Next 타입 (자동 생성)
│   ├── Dockerfile.dev                     # 개발용 이미지
│   ├── public/                            # 정적 파일
│   └── src/
│       ├── styles/
│       │   └── globals.css                # Tailwind 디렉티브 + 컴포넌트 클래스
│       │
│       ├── app/                           # App Router 페이지
│       │   ├── layout.tsx                 # 루트 레이아웃 (Header/Footer)
│       │   ├── page.tsx                   # 랜딩 페이지
│       │   ├── (auth)/                    # 인증 라우트 그룹
│       │   │   ├── login/page.tsx         # 로그인 폼
│       │   │   ├── register/page.tsx      # 회원가입 폼 (.ac.kr 안내)
│       │   │   └── verify-email/page.tsx  # 메일 인증 안내/처리
│       │   ├── recruit/
│       │   │   ├── page.tsx               # 구인 리스트 (필터/검색)
│       │   │   └── [id]/page.tsx          # 구인 상세 + 지원 버튼
│       │   ├── team/
│       │   │   ├── page.tsx               # 팀 리스트
│       │   │   ├── create/page.tsx        # 팀 생성 + 기획서 작성 폼
│       │   │   └── [id]/page.tsx          # 팀 상세 (기획서 + 멤버)
│       │   ├── profile/
│       │   │   ├── page.tsx               # 내 프로필 + 포트폴리오 카드
│       │   │   └── [id]/page.tsx          # 타인 프로필 + 채팅하기
│       │   └── chat/
│       │       ├── page.tsx               # 채팅방 리스트
│       │       └── [roomId]/page.tsx      # 채팅방 (메시지/입력)
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Header.tsx             # 상단 네비게이션
│       │   │   ├── Footer.tsx             # 하단 푸터
│       │   │   └── Sidebar.tsx            # 사이드바
│       │   ├── ui/                        # 공통 UI (예정)
│       │   ├── recruit/                   # 구인 관련 (예정)
│       │   ├── team/                      # 팀 관련 (예정)
│       │   ├── profile/                   # 프로필 관련 (예정)
│       │   └── chat/                      # 채팅 관련 (예정)
│       │
│       ├── hooks/
│       │   ├── useAuth.ts                 # 로그인/로그아웃/유저 상태
│       │   └── useSocket.ts               # Socket.IO 연결 관리
│       │
│       └── lib/
│           ├── api.ts                     # axios 인스턴스 (JWT 자동 첨부)
│           └── utils.ts                   # formatDate, truncateText, timeAgo
│
└── backend/                               # @mocozi/backend (NestJS)
    ├── package.json
    ├── pnpm-lock.yaml
    ├── pnpm-workspace.yaml                # 빌드 허용 패키지
    ├── .npmrc                             # node-linker=hoisted (Docker 호환)
    ├── tsconfig.json
    ├── nest-cli.json                      # NestJS CLI 설정
    ├── eslint.config.mjs                  # ESLint flat config
    ├── .env.example                       # 환경 변수 템플릿
    ├── Dockerfile.dev                     # 개발용 이미지 (prisma db push 자동)
    │
    ├── prisma/
    │   └── schema.prisma                  # 전체 DB 스키마 (10+ 모델)
    │
    └── src/
        ├── main.ts                        # 진입점 (CORS, ValidationPipe, /api 프리픽스)
        ├── app.module.ts                  # 루트 모듈 (모든 모듈 통합)
        │
        ├── prisma/                        # Prisma 모듈 (전역)
        │   ├── prisma.module.ts
        │   └── prisma.service.ts          # PrismaClient 확장 + 생명주기 관리
        │
        ├── auth/                          # 인증
        │   ├── auth.module.ts
        │   ├── auth.controller.ts         # POST register/login, GET verify-email
        │   ├── auth.service.ts            # 회원가입(.ac.kr 검증), 로그인, JWT 발급
        │   ├── strategies/
        │   │   └── jwt.strategy.ts        # Passport JWT 전략
        │   ├── guards/
        │   │   └── jwt-auth.guard.ts      # @UseGuards()용 인증 가드
        │   └── dto/
        │       ├── register.dto.ts        # 가입 DTO (.ac.kr 정규식)
        │       └── login.dto.ts
        │
        ├── user/                          # 사용자 프로필
        │   ├── user.module.ts
        │   ├── user.controller.ts         # GET /users/me, GET /users/:id, PUT /users/me
        │   ├── user.service.ts
        │   └── dto/
        │       └── update-profile.dto.ts
        │
        ├── portfolio/                     # 포트폴리오 (카드 단위 CRUD)
        │   ├── portfolio.module.ts
        │   ├── portfolio.controller.ts
        │   ├── portfolio.service.ts
        │   └── dto/
        │       ├── create-portfolio.dto.ts # type: project/research/activity/etc
        │       └── update-portfolio.dto.ts
        │
        ├── team/                          # 팀 + 기획서
        │   ├── team.module.ts
        │   ├── team.controller.ts         # 팀 생성, 기획서 작성, 조회
        │   ├── team.service.ts
        │   └── dto/
        │       ├── create-team.dto.ts
        │       └── create-proposal.dto.ts # 필수/선택 공개 정보 분리
        │
        ├── recruit/                       # 구인 게시글 + 지원
        │   ├── recruit.module.ts
        │   ├── recruit.controller.ts      # CRUD + apply
        │   ├── recruit.service.ts
        │   └── dto/
        │       ├── create-recruit.dto.ts  # visibility: PUBLIC/UNIVERSITY_ONLY
        │       └── apply-recruit.dto.ts
        │
        ├── chat/                          # 실시간 채팅
        │   ├── chat.module.ts
        │   ├── chat.gateway.ts            # WebSocket 게이트웨이 (joinRoom/sendMessage)
        │   ├── chat.service.ts            # 메시지 저장 + 채팅방 관리
        │   └── dto/
        │       └── send-message.dto.ts
        │
        ├── search/                        # 통합 검색
        │   ├── search.module.ts
        │   ├── search.controller.ts       # GET /search/recruits, /search/users
        │   └── search.service.ts          # skill/role/university 필터
        │
        └── common/                        # 공통 유틸 (전역 적용)
            ├── filters/
            │   └── http-exception.filter.ts  # 일관된 에러 응답
            ├── interceptors/
            │   └── transform.interceptor.ts  # 응답 {success, data, timestamp} 래핑
            └── decorators/
                └── current-user.decorator.ts # @CurrentUser() 추출
```

---

## 4. 기능 ↔ 파일 매핑

기획서의 핵심 기능을 어떤 파일에서 구현하는지 한눈에 보기 위한 표:

### 4.1 인증 시스템 (.ac.kr 메일 인증)
| 단계 | 위치 |
|------|------|
| 회원가입 폼 | `frontend/src/app/(auth)/register/page.tsx` |
| 회원가입 API | `backend/src/auth/auth.controller.ts` `POST /api/auth/register` |
| 메일 검증 로직 | `backend/src/auth/auth.service.ts` (`.ac.kr` 정규식) |
| DB 모델 | `backend/prisma/schema.prisma` `User.emailVerified`, `verificationToken` |
| 인증 메일 페이지 | `frontend/src/app/(auth)/verify-email/page.tsx` |
| JWT 발급/검증 | `backend/src/auth/strategies/jwt.strategy.ts`, `guards/jwt-auth.guard.ts` |
| 클라이언트 토큰 관리 | `frontend/src/hooks/useAuth.ts`, `frontend/src/lib/api.ts` (인터셉터) |

### 4.2 기획서 시스템 (필수/선택 공개 분리)
| 단계 | 위치 |
|------|------|
| 기획서 작성 폼 | `frontend/src/app/team/create/page.tsx` |
| 기획서 작성 API | `backend/src/team/team.controller.ts` `POST /api/teams/:id/proposal` |
| 비즈니스 로직 | `backend/src/team/team.service.ts` |
| DTO (필수/선택 분리) | `backend/src/team/dto/create-proposal.dto.ts` |
| DB 모델 | `backend/prisma/schema.prisma` `TeamProposal` |
| 공유 타입 | `shared/types/team.ts` `TeamProposal`, `RequiredPublicInfo`, `OptionalPublicInfo` |

### 4.3 구인/지원 시스템
| 단계 | 위치 |
|------|------|
| 구인 리스트 (필터/검색) | `frontend/src/app/recruit/page.tsx` |
| 구인 상세 + 지원 | `frontend/src/app/recruit/[id]/page.tsx` |
| 구인 API | `backend/src/recruit/recruit.controller.ts` |
| 통합 검색 | `backend/src/search/search.service.ts` (skill/role/university 필터) |
| DB 모델 | `backend/prisma/schema.prisma` `RecruitPost`, `Application` |

### 4.4 프로필 / 포트폴리오 (카드형)
| 단계 | 위치 |
|------|------|
| 내 프로필 + 포트폴리오 | `frontend/src/app/profile/page.tsx` |
| 타인 프로필 | `frontend/src/app/profile/[id]/page.tsx` |
| 프로필 API | `backend/src/user/user.controller.ts` |
| 포트폴리오 CRUD | `backend/src/portfolio/portfolio.controller.ts` |
| 활동 유형(카드 type) | `shared/types/portfolio.ts` `PortfolioItemType` (project/research/activity/etc) |
| 도메인 태그 | DB `PortfolioItem.tags`, `PortfolioItem.domain` |

### 4.5 실시간 채팅
| 단계 | 위치 |
|------|------|
| 채팅방 리스트 | `frontend/src/app/chat/page.tsx` |
| 채팅방 화면 | `frontend/src/app/chat/[roomId]/page.tsx` |
| Socket 클라이언트 | `frontend/src/hooks/useSocket.ts` |
| WebSocket 게이트웨이 | `backend/src/chat/chat.gateway.ts` |
| 메시지 저장 | `backend/src/chat/chat.service.ts` |
| DB 모델 | `backend/prisma/schema.prisma` `ChatRoom`, `ChatMessage`, `ChatRoomUser` |

---

## 5. DB 스키마 요약

`backend/prisma/schema.prisma` 내 주요 모델:

| 모델 | 역할 |
|------|------|
| `User` | 사용자 + 대학 메일 인증 상태 |
| `Team` / `TeamMember` | 팀 + 멤버 관계 |
| `TeamProposal` | 기획서 (필수/선택 공개 정보 분리) |
| `RecruitPost` / `Application` | 구인 게시글 + 지원 |
| `Portfolio` / `PortfolioItem` | 포트폴리오 + 카드 (type enum: PROJECT/RESEARCH/ACTIVITY/ETC) |
| `ChatRoom` / `ChatRoomUser` / `ChatMessage` | 채팅 (다대다 + 메시지) |

스키마 변경 시:
- 컨테이너 재시작만 하면 자동 동기화됨 (Dockerfile의 `prisma db push`)
- 호스트 직접 개발 시: `cd backend && pnpm prisma db push`

---

## 6. 환경 변수

### `backend/.env` (각자 생성, gitignored)

`.env.example`을 복사해서 사용:
```bash
cp backend/.env.example backend/.env
```

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 접속 URL | docker compose 환경: `db:5432` / 호스트 직접 실행: `localhost:5432` |
| `JWT_SECRET` | JWT 서명 시크릿 | 운영 시 반드시 강한 값으로 교체 |
| `SMTP_*` | 메일 발송 (인증) | 추후 실제 값으로 교체 |
| `FRONTEND_URL` | CORS 허용 도메인 | `http://localhost:3000` |
| `PORT` | 백엔드 포트 | `8080` |

### `frontend/` (현재 docker-compose에서 environment로 주입)
| 변수 | 용도 | 값 |
|------|------|-----|
| `NEXT_PUBLIC_API_URL` | API 베이스 URL | `http://localhost:8080` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL | `http://localhost:8080` |

---

## 7. 개발 환경 (로컬 시작 가이드)

### 7.1 첫 세팅 (한 번만)

```bash
# 1) 사전 도구
#    - Git, Docker Desktop 설치
#    - nvm 설치: Win은 nvm-windows, Mac은 brew install nvm

# 2) 레포 클론
git clone https://github.com/next-mocozi/mocozi.git
cd mocozi

# 3) Node 버전 적용
nvm install 24.15.0
nvm use

# 4) pnpm 설치
npm install -g pnpm@10.33.2

# 5) 환경 변수
cp backend/.env.example backend/.env

# 6) Docker Desktop 실행 상태 확인
docker --version
```

### 7.2 일상 개발 (Docker 모드)

```bash
docker compose up                # 첫 실행은 5~10분, 이후 수십 초
docker compose up -d             # 백그라운드
docker compose stop              # 일시 정지 (컨테이너 보존)
docker compose start             # 정지된 거 재시작 (가장 빠름)
docker compose down              # 컨테이너 제거
docker compose down -v           # 컨테이너 + DB 데이터까지 제거 ⚠️
docker compose logs -f backend   # 백엔드 실시간 로그
docker compose ps                # 상태 확인
```

| URL | 서비스 |
|-----|--------|
| http://localhost:3000 | Frontend |
| http://localhost:8080/api | Backend API |
| localhost:5432 | PostgreSQL (user: mocozi, db: mocozi_db) |

### 7.3 호스트 직접 개발 (선택, 더 빠른 핫리로드)

```bash
# DB만 Docker로
docker compose up db -d

# 호스트 의존성 설치 (한 번)
cd backend && pnpm install
cd ../frontend && pnpm install

# 실행 (각각 다른 터미널)
cd backend && pnpm start:dev    # localhost:8080
cd frontend && pnpm dev         # localhost:3000
```

> 호스트 모드에서는 `backend/.env`의 `DATABASE_URL`을 `localhost:5432` 기준으로 변경 필요

---

## 8. 주요 명령어 모음

### Backend
```bash
cd backend
pnpm start:dev        # nest watch (개발)
pnpm build            # 프로덕션 빌드
pnpm test             # Jest 테스트
pnpm lint             # ESLint
pnpm prisma:generate  # Prisma Client 재생성
pnpm prisma:migrate   # 마이그레이션 생성/적용
pnpm prisma:studio    # DB GUI (localhost:5555)
```

### Frontend
```bash
cd frontend
pnpm dev              # next dev (개발)
pnpm build            # 프로덕션 빌드
pnpm start            # 빌드 결과 실행
pnpm lint             # ESLint
pnpm type-check       # tsc --noEmit
```

---

## 9. 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 프로덕션 배포 (보호 브랜치) |
| `develop` | 개발 통합 |
| `feature/<기능명>` | 기능 개발 |
| `hotfix/<이슈명>` | 긴급 수정 |

워크플로우:
1. `develop`에서 `feature/xxx` 브랜치 생성
2. 작업 후 `develop`으로 PR
3. 리뷰 → 머지
4. 배포 시 `develop` → `main`

---

## 10. 기여 가이드라인 (간단)

- **커밋 메시지**: `<type>: <한글 설명>` (예: `feat: 회원가입 폼 추가`, `fix: 메일 검증 정규식 버그`)
- **PR 생성 시**: 루트 `.github/PULL_REQUEST_TEMPLATE.md` 자동 적용
- **포맷팅**: `.prettierrc` 적용 → 저장 시 자동 (VS Code Prettier 확장 권장)
- **린트**: PR 전 `pnpm lint` 통과 확인
- **DB 변경**: `prisma/schema.prisma` 수정 시 PR 본문에 변경 의도 명시

---

## 11. 참고 / 향후 추가 예정

- [ ] CI/CD (GitHub Actions) — 현재 락 파일 셋업 마무리 후 재추가
- [ ] 메일 발송 SMTP 실제 연동 (현재는 인증 토큰 발급까지만 구현)
- [ ] 프론트엔드 페이지의 실제 데이터 연동 (현재 플레이스홀더)
- [ ] shared 타입을 frontend/backend에서 실사용하도록 import 마이그레이션
- [ ] 통합 테스트 / E2E 테스트
