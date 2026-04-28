# 모코지 (Mocozi)

> IT계열 대학생을 위한 프로젝트/해커톤/스터디 구인 및 네트워킹 플랫폼

대학교 메일 인증 기반의 신뢰할 수 있는 팀 빌딩 서비스입니다.

## 핵심 기능

- **대학 메일 인증**: `.ac.kr` 메일 인증으로 검증된 사용자만 이용 가능
- **기획서 시스템**: 정형화된 기획서 작성 + 공개 범위 2단계 분리로 아이디어 보호
- **구인/지원**: 스킬·직군·학교 등 조건별 세분화 검색, 서비스 내 채팅 및 대면 만남 지원
- **프로필/포트폴리오**: 활동 유형별 카드 형태 포트폴리오, 도메인 태그 기능

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Nest.js, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| 실시간 채팅 | Socket.IO |
| 패키지 매니저 | pnpm |
| 컨테이너 | Docker, Docker Compose |

## 프로젝트 구조

```
mocozi/
├── frontend/    # Next.js 프론트엔드
├── backend/     # Nest.js 백엔드
├── shared/      # 공유 타입 및 상수
└── .github/     # CI/CD 워크플로우
```

## 로컬 개발 환경 세팅

### 사전 요구사항

- Node.js 24.15.0 (`.nvmrc` 제공 — `nvm use` 권장)
- pnpm 10.33.2 (`packageManager` 필드로 자동 적용)
- Docker & Docker Compose

### 방법 1: Docker Compose (권장)

```bash
# 전체 서비스 한 번에 실행
docker-compose up

# 백그라운드 실행
docker-compose up -d

# 종료
docker-compose down
```

### 방법 2: 개별 실행

```bash
# 1. 의존성 설치
cd frontend && pnpm install
cd ../backend && pnpm install

# 2. 환경 변수 설정
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env

# 3. DB 실행 (Docker)
docker-compose up db -d

# 4. Prisma 마이그레이션
cd backend && pnpm prisma migrate dev

# 5. 각 서비스 실행
cd frontend && pnpm dev   # http://localhost:3000
cd backend && pnpm start:dev  # http://localhost:8080
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
