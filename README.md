# 모코지 (Mocozi)

> IT계열 대학생을 위한 프로젝트/해커톤/스터디 구인 및 네트워킹 플랫폼

대학교 메일(`.ac.kr`) 인증 기반의 신뢰할 수 있는 팀 빌딩 서비스입니다.

## 핵심 기능

- **대학 메일 인증**: `.ac.kr` 메일 인증으로 검증된 사용자만 이용 가능
- **기획서 시스템**: 정형화된 기획서 + **필수/선택 공개 2단계 분리**로 아이디어 재산권 보호
- **구인/지원**: 스킬·직군·학교 조건별 세분화 검색 + 서비스 내 채팅
- **프로필/포트폴리오**: 활동 유형별 카드형 포트폴리오, 도메인 태그

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS 4 |
| Backend | NestJS 11, TypeScript 5.9, Prisma 6 |
| Database | PostgreSQL 17 |
| 실시간 채팅 | Socket.IO 4.8 |
| 런타임 | Node.js 24.15.0 |
| 패키지 매니저 | pnpm 10.33.2 |
| 컨테이너 | Docker, Docker Compose |

## 프로젝트 구조

```
mocozi/
├── frontend/        # Next.js 프론트엔드
├── backend/         # NestJS 백엔드
├── shared/          # 공유 타입 및 상수 (@mocozi/shared)
├── docker-compose.yml
├── README.md
└── CLAUDE.md        # 프로젝트 전반 정보 (구조·기능·DB·환경변수 등)
```

자세한 디렉토리 구조, 기능별 구현 위치, DB 스키마, 환경 변수, 개발 가이드라인은 **[`CLAUDE.md`](./CLAUDE.md)** 참고.

## 로컬 개발 환경 세팅

### 사전 요구사항

- Node.js 24.15.0 (`.nvmrc` 제공 — `nvm use` 권장)
- pnpm 10.33.2 (`packageManager` 필드로 자동 적용)
- Docker & Docker Compose

### 방법 1: Docker Compose (권장)

```bash
# 환경 변수 파일 생성 (한 번만)
cp backend/.env.example backend/.env

# 전체 서비스 한 번에 실행
docker compose up

# 백그라운드 실행
docker compose up -d

# 종료
docker compose down
```

다음 메시지가 보이면 성공:
```
✓ db        : database system is ready
✓ backend   : 🚀 모코지 API 서버가 포트 8080에서 실행 중
✓ frontend  : ✓ Ready in XXXms
```

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/api |
| PostgreSQL | localhost:5432 (user: `mocozi`, db: `mocozi_db`) |

코드 수정은 hot reload로 자동 반영됩니다.

### 방법 2: 개별 실행 (호스트 직접 실행)

```bash
# 1. 의존성 설치
cd frontend && pnpm install
cd ../backend && pnpm install

# 2. 환경 변수 설정
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
# backend/.env의 DATABASE_URL 호스트를 'localhost'로 변경

# 3. DB만 Docker로 실행
docker compose up db -d
# 3-1. prisma studio를 통한 DB 직접 조회
docker compose exec backend npx prisma studio

# 4. Prisma 스키마 동기화
cd backend && pnpm prisma db push

# 5. 각 서비스 실행 (다른 터미널)
cd frontend && pnpm dev          # http://localhost:3000
cd backend && pnpm start:dev     # http://localhost:8080
```

### 일상 명령어

```bash
docker compose up               # 시작
docker compose up -d            # 백그라운드
docker compose stop             # 일시 정지 (컨테이너 보존)
docker compose start            # 재시작 (가장 빠름)
docker compose down             # 컨테이너 제거
docker compose down -v          # ⚠️ DB 데이터까지 제거
docker compose logs -f backend  # 백엔드 로그
docker compose restart backend  # 스키마 변경 후 backend만 재시작
```

## 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 프로덕션 배포 브랜치 |
| `develop` | 개발 통합 브랜치 |
| `feature/*` | 기능 개발 브랜치 |
| `hotfix/*` | 긴급 버그 수정 브랜치 |

### 워크플로우

1. `develop`에서 `feature/기능명` 브랜치 생성
2. 작업 완료 후 `develop`으로 PR 생성
3. 코드 리뷰 후 머지
4. 배포 시 `develop` → `main` 머지

## 팀원

| 이름 | 역할 | GitHub |
|------|------|--------|
| TBD | TBD | TBD |

## 라이선스

Private - All rights reserved.
