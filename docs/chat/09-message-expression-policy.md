# 메시지 표현 정책 — Stance B (게이트웨이) 시작

| 항목 | 값 |
|---|---|
| 작성일 | 2026-05-09 |
| 버전 | v1.0 |
| 다음 리뷰 | Phase 중간(가벼운 D) 진입 시점 또는 사용자 요구 변화 시 |
| 컨텍스트 | 모코지(mocozi) — IT계열 대학생 팀빌딩 플랫폼. 학생 팀 13일 Phase A 완료 시점 |
| 적용 범위 | DM 모듈의 메시지 본문 + 첨부 콘텐츠 |

---

## Context

DM의 "메시지 표현력을 어디까지 허용할 것인가"는 단순 마크다운 토글 문제가 아닌 **표현력 스펙트럼** 문제로 재정의:

```
Plain → Markdown → Code → Diagram → Rich Card → Interactive
```

Anthropic 측 "HTML/SVG 풀파워" 트렌드(Thariq의 *Unreasonable Effectiveness of HTML*)는 **AI 산출물을 사람이 읽기 위한 매체**로서의 HTML이고, 메시지 앱의 **휘발성 사용자 작성 단위**와는 본질이 다름. 따라서:

- 메시지에 raw HTML/SVG 풀파워 ❌ (보안·렌더링·검색·모바일 모두 부적절)
- "AI 산출물의 통로(게이트웨이) 역할을 잘하는 메시지 앱" ✅ (모코지 컨텍스트와 부합 — CS 학생들이 코드/링크/AI 산출물 빈번히 공유)

### 핵심 철학

> 우리는 AI 출력을 흉내내지 않는다. AI 출력이 잘 흘러다니는 강을 판다.

### 장기 방향 명시 — Stance D 도입 의지

**본 정책은 Phase 현재(Stance B)에서 시작하지만, 종착점은 Stance D(실시간 협업 캔버스)**.
Stance B는 표현력 게이트웨이, 가벼운 D는 비실시간 보드, D는 실시간 캔버스로 **단계적 진화**가 명시된 의도된 경로.

- 학기 프로젝트 단계라 D 풀구현은 어렵지만, **데이터 모델·정책·UI 패턴 결정은 D를 향해 누적 가능한 방향**으로 한다.
- 가벼운 D / D 도입 시점은 [Phase 전환 트리거](#phase-전환-트리거) 섹션의 객관 조건 충족 시.
- 결정 거부 트리거(보안 인시던트 / 사용자 수 정체 등)도 함께 명시 — 의지가 무비판적 진행을 의미하지 않음.

---

## 3단계 진화 경로

```
┌────────────────────────┐    ┌────────────────────────┐    ┌────────────────────────┐
│  Phase 현재            │    │  Phase 중간            │    │  Phase 장기            │
│  Stance B (게이트웨이)│ →  │  가벼운 D (비실시간)  │ →  │  Stance D (실시간)    │
├────────────────────────┤    ├────────────────────────┤    ├────────────────────────┤
│ markdown / code        │    │ + 대화방 [📌보드] 탭 │    │ + 실시간 협업 캔버스  │
│ mermaid (선택)         │    │ + 비실시간 보드       │    │   (Yjs/Automerge)     │
│ 화이트리스트 임베드   │    │ + 옵티미스틱 락       │    │ + 권한 모델 확장      │
│ AI 라벨링             │    │ + 메시지→보드 고정   │    │ + 검색·인덱싱 통합    │
│ rehype-sanitize       │    │   (다이어그램·결정사항)│   │ + 모바일 캔버스 UX    │
└────────────────────────┘    └────────────────────────┘    └────────────────────────┘
       지금 여기                    학기 내 가능                  졸업 후 / 정식 제품화
```

| 스탠스 | 보안 부담 | 협업 인프라 | 모바일 부담 | 학기 프로젝트 적합성 |
|---|---|---|---|---|
| B 게이트웨이 | 낮음 | 없음 | 낮음 | ✅ 현재 단계 |
| 가벼운 D | B + α | 없음 (옵티미스틱 락) | 중간 | ✅ 학기 내 |
| D 실시간 | B의 3~5배 | CRDT/OT | 높음 | ❌ 졸업 후 |

---

## Phase 현재 — Stance B 구현 가이드라인

### 메시지 본문 — 허용 입력

| 항목 | 허용 | 비고 |
|---|---|---|
| Plain text | ✅ | 기본 |
| Markdown 인라인 (`**bold**`, `*italic*`, `` `code` ``, `[link](url)`) | ✅ | 모든 메시지를 마크다운으로 일괄 렌더 (plain text는 superset이라 자동 호환) |
| Markdown 블록 (`#`, `>`, `-`, `1.`, ``` ``` `) | ✅ | 코드 블록 포함 |
| 코드 블록 + 언어 힌트 (` ```ts `) | ✅ | shiki 또는 prism으로 syntax highlighting |
| Mermaid 다이어그램 (` ```mermaid `) | ⚠️ Phase 중간으로 이연 | sandbox 부담 + 렌더 비용. 우선 코드 블록으로만 표시, Phase 중간에 렌더 활성화 |
| 한국어/영어 emoji 🎉 | ✅ | unicode 그대로 |

### 메시지 본문 — 금지 입력

| 항목 | 금지 | 이유 |
|---|---|---|
| Raw HTML 태그 | ❌ | XSS 표면. rehype-sanitize로 strip |
| Raw SVG | ❌ | inline svg는 script 실행 가능. 외부 이미지 URL은 별도 attachment 패턴 권장 |
| `javascript:` URL | ❌ | XSS |
| `<style>`, `<iframe>` | ❌ | 권한 격리 깨짐 |
| 사용자 작성 raw CSS | ❌ | 렌더 격리 |

### 첨부 / 임베드 — 우리 attachment 마커 패턴 활용

기존 시스템 ([`frontend/src/lib/messageTemplate.ts`](frontend/src/lib/messageTemplate.ts)):
```
[[link:<type>:<targetId>|<label>]]
```

| Type | Phase A | Phase B 추가 검토 |
|---|---|---|
| `profile` | ✅ 사용 중 (양식 시스템) | — |
| `team` | 양식 시스템 컨텍스트 재설계 시 (Phase B) | — |
| `portfolio` | Phase B | — |
| `embed:claude` | ❌ Phase 중간 | Claude.ai 공유 링크 → 카드 렌더 |
| `embed:gist` | ❌ Phase 중간 | GitHub gist → 코드 미리보기 카드 |
| `embed:codepen` | ❌ Phase 중간 | CodePen → iframe sandbox 카드 |
| `embed:og` | ❌ Phase 중간 | 일반 URL Open Graph 카드 |

**화이트리스트 검증**: frontend의 `parseAttachmentMarker`에서 type 검증. 알려지지 않은 type은 무시(plain 텍스트 표시).

### AI 라벨링

AI 어시스트로 작성·변환된 메시지는 **명시적 시각 표시** 의무.
- Phase 현재: 사용자 인앱 AI 어시스트 도입 X → 라벨링 적용 대상 없음
- Phase 중간 이후: AI 어시스트 도입 시 메시지 옆에 🤖 같은 시각 표시 + tooltip

### 보안

| 영역 | 도구 / 정책 |
|---|---|
| Markdown 렌더 | `react-markdown` + `rehype-sanitize` |
| 외부 링크 | 모든 외부 링크에 `rel="noopener noreferrer"` + `target="_blank"` |
| URL 스킴 화이트리스트 | `http://`, `https://`, `mailto:` 외 모두 차단 |
| 이미지 src | https 강제 (Phase 중간에 CSP `img-src` 추가) |
| iframe / sandboxed embed | Phase 중간에서 `sandbox="allow-same-origin"` 등 격리 적용 |

### 백엔드

- 변경 사항 **0** (Phase 현재)
- `ChatMessage.content`는 그대로 텍스트 저장
- 마크다운 파싱·sanitize는 **클라이언트 단**에서 (저장 시점이 아닌 렌더 시점에)
- 이유: 동일 데이터를 다른 클라이언트(모바일·웹)가 자기 정책으로 렌더 가능. 서버는 raw 보존이 정확.

### 프론트엔드 — 신규 도입

| 패키지 | 용도 |
|---|---|
| `react-markdown` | Markdown → React 변환 |
| `rehype-sanitize` | 위험 태그·속성 strip |
| `remark-gfm` | GFM(GitHub Flavored Markdown) — 표·체크리스트 등 |
| `shiki` 또는 `prism-react-renderer` | 코드 블록 syntax highlighting |

### 적용 위치

[`frontend/src/app/chat/[roomId]/page.tsx`](frontend/src/app/chat/[roomId]/page.tsx) 또는 별도 컴포넌트:
- 현재 `MessageRow` 본문 표시는 plain text + attachment 마커 파싱
- 변경: 본문을 markdown 컴포넌트로 렌더 (sanitize 적용)
- 마커는 기존 `parseAttachmentMarker`로 사전 분리 → 본문 텍스트 + attachment 분리 그대로

---

## 데이터 모델 — Phase 현재 변경 0

### 결정: 단계적 도입

Phase 현재 — **schema 변경 없음**. 모든 메시지를 마크다운 단일 type으로 처리. 기존 [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)의 `ChatMessage` / `ChatRoom` 그대로 사용:

```prisma
model ChatMessage {
  id        String      @id @default(uuid())
  roomId    String
  senderId  String
  content   String      @db.Text     // 무제한 길이 (코드 블록 등)

  parentId  String?                  // 답글 (자기참조)
  editedAt  DateTime?                // null: 미수정. 값: "(편집됨)" 표시
  deletedAt DateTime?                // 소프트 삭제. UI는 "삭제된 메시지" placeholder

  createdAt DateTime    @default(now())
  // ... 관계 ...
}

model ChatRoom {
  id            String        @id @default(uuid())
  type          ChatRoomType  @default(DIRECT)
  // ... 기존 필드 ...
}
```

### Phase 중간 진입 시 추가 검토 (현재 미적용)

```prisma
model ChatMessage {
  // ... 기존 ...
  metadata  Json?       // type별 풍부한 데이터 (예: { kind: 'code', language: 'ts' }, { aiGenerated: true })
}

model ChatRoom {
  // ... 기존 ...
  // 외부 entity와의 1:1 연결 (포트폴리오/구인글 등) — 의미 명확해지면 추가
  contextType   ContextType?
  contextRefId  String?
}

enum ContextType {
  RECRUIT_POST
  PORTFOLIO
  COMMUNITY_POST
}
```

**이른 도입 회피 이유**:
- `metadata Json?`은 빈 컬럼이라 영향 없지만, Phase 현재엔 **사용처 0개** → "쓰일 곳 정해진 후 추가" 원칙 준수
- 기존 모델(`MessageContext` enum + 양식 시스템)이 이미 컨텍스트 표현 일부 담당 — 중복 차원 도입 회피

### 비수용 항목 — 제안 vs 우리 결정

| 제안 | 비수용 사유 |
|---|---|
| `type: MessageType` enum 추가 | 모든 메시지 markdown 단일 처리 충분. `TEXT` vs `MARKDOWN` 구분 무의미 (markdown은 plain의 superset). `CODE`/`DIAGRAM`은 마크다운 코드 블록으로. `RICH_CARD`/`EMBED`는 attachment 마커로 처리 중 |
| `contentVersion: Int` | 형식 호환성 깨질 큰 변경 없음. 필요 시 `metadata.version`으로 충분 |
| `AI_GENERATED` type 분리 | AI 생성은 flag 성격(한 메시지가 markdown + AI 생성 가능). type 분리 X, `metadata.aiGenerated: true`로 처리 |
| `Conversation.contextType` 즉시 도입 | `ChatRoomType` (DIRECT/GROUP/CHANNEL)과 차원 다름. 한 방 안에서도 메시지별 컨텍스트 다를 수 있음(`MessageContext` enum이 메시지 양식 단위). Phase B에서 의미 명확해질 때 추가 검토 |

---

## 허용 vs 금지 — 한 표 요약

### 사용자가 메시지로 작성 가능

| 카테고리 | 허용 | 금지 |
|---|---|---|
| **텍스트** | plain, markdown 인라인/블록, emoji | raw HTML, raw SVG |
| **코드** | ` ```언어 ` 마크다운 코드 블록 | `<script>` 태그 직접 작성 |
| **링크** | `[텍스트](https://...)`, `[텍스트](mailto:...)` | `[텍스트](javascript:...)`, `[텍스트](data:...)` |
| **이미지** | https 외부 URL의 이미지 (Phase 중간 검토) | inline base64, http URL |
| **첨부** | `[[link:profile:id\|라벨]]` 등 정의된 attachment 마커 | 알려지지 않은 마커 type (무시됨) |
| **다이어그램** | ` ```mermaid ` 코드 블록 (Phase 중간에 렌더 활성) | 직접 SVG, 직접 canvas |

### 시스템이 자동 처리

| 항목 | 동작 |
|---|---|
| URL 자동 감지 | Phase 중간에서 OG 카드 자동 합성 (현재 X) |
| AI 산출물 임베드 | Phase 중간에서 화이트리스트(Claude.ai/gist/CodePen) → 카드 |
| 외부 링크 클릭 | 새 탭 + `noopener noreferrer` |
| iframe sandbox | 화이트리스트 임베드만, `sandbox="allow-same-origin"` |

---

## 의사결정 포인트 — 현재 미정

| # | 항목 | 현재 상태 | 결정 시점 |
|---|---|---|---|
| 1 | AI 산출물 임베드 화이트리스트 범위 (Claude.ai만? + GitHub? + 일반 OG?) | **미정** | Phase 중간 진입 시 |
| 2 | 인앱 AI 어시스트 도입 시점 및 범위 | **미정** | Phase B 후반 또는 가벼운 D |
| 3 | AI 라벨링 강도 (명시 라벨 / 유저 토글 / 메타데이터만) | **미정** (현재 라벨링 대상 0) | AI 어시스트 도입 시 |
| 4 | 외부 링크 동작 (새 탭 / 인앱 모달 / sandboxed iframe) | 새 탭 단순 (Phase 현재) | Phase 중간에서 sandbox 검토 |
| 5 | 사용자 작성 raw SVG/HTML 허용 | **금지** (현재 정책) | 변경 시 보안 재검토 필수 |
| 6 | Mermaid 다이어그램 렌더 활성 시점 | Phase 중간 | sandbox 부담 vs CS 학생 가치 비교 후 |
| 7 | 코드 블록 syntax highlighter 선택 (`shiki` vs `prism`) | **미정** | 마크다운 도입 PR 시점에 결정 |

---

## Phase 전환 트리거

### Phase 현재(B) → Phase 중간(가벼운 D) 전환 조건

다음 중 2개 이상 충족 시 가벼운 D 진입 검토:

- [ ] DM 모듈 안정화 — 회귀 테스트 통과 + 운영 배포 후 1주 안정
- [ ] AI 산출물 공유 빈도 ↑ — 사용자가 Claude/GPT 링크 메시지 본문에 빈번히 붙임
- [ ] 사용자 보고 — "다이어그램이 코드로만 보임" 또는 "긴 결정사항 따로 모으고 싶음"
- [ ] 사용자 수 / 채팅방 수 ↑ — 가벼운 D의 "보드" 가치가 임계 도달

### Phase 중간(가벼운 D) → Phase 장기(D) 전환 조건

다음 모두 충족 시 D 진입 검토:

- [ ] 졸업 후 정식 제품화 또는 추가 학기 진행 의사
- [ ] 동시 편집 사용자 수 임계 도달 (예: 같은 보드 동시 편집 충돌 빈번)
- [ ] CRDT/OT 인프라 도입 가능한 인적 자원 (전담 개발자 1+)
- [ ] 모바일 캔버스 UX 디자이너 / 리소스 확보

전환 거부 트리거:
- 사용자 수 / 활성 채팅 방 수 정체 → 가벼운 D 유지로 충분
- 보안 인시던트 발생 → 표현력 확장 일시 동결

---

## 우리 코드와의 매핑 — 현재 사용 중

| 정책 항목 | 우리 코드 위치 |
|---|---|
| 첨부 마커 시스템 | [`frontend/src/lib/messageTemplate.ts`](frontend/src/lib/messageTemplate.ts) — `parseAttachmentMarker`, `appendAttachmentMarker` |
| 메시지 모델 | [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) — `ChatMessage` |
| 양식 시스템 (컨텍스트별 첫 메시지) | [`backend/src/template/`](backend/src/template), [`frontend/src/components/chat/Template*.tsx`](frontend/src/components/chat) |
| Soft delete | `ChatMessage.deletedAt` 기반 placeholder 렌더 |
| 메시지 검색 (Phase B) | 현재 X — Phase 중간에서 `content` 인덱스 + 권한 필터링 |

---

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-09 | 최초 작성 — Stance B 정책 합의. Phase 진화 경로 + 비판적 수용 결과 통합 |

---

## 참고 자료

- Anthropic, Thariq, *Unreasonable Effectiveness of HTML* (해당 글의 컨텍스트는 AI 산출물 매체이지 메시지 앱 아님 — 비판적 수용)
- Slack Canvas, Linear, Notion 같은 "shared canvas" 패턴 — Phase 장기 D의 참조점
- 현재 모코지 attachment 마커 시스템 — Phase B에서 임베드 type 추가로 확장 예정
