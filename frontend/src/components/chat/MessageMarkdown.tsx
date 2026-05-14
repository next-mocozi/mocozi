'use client';

// KaTeX CSS — Tailwind v4 PostCSS가 globals.css의 node_modules @import 처리 못 해 컴포넌트 단에서 import
// 효과: chat 페이지(MessageMarkdown 사용처) 진입 시에만 ~280KB CSS 로드
import 'katex/dist/katex.min.css';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Highlight, themes } from 'prism-react-renderer';

/**
 * 메시지 본문 마크다운 렌더 — Stance B 게이트웨이 정책 (docs/chat/09).
 *
 * 허용:
 *  - markdown 인라인/블록 (bold, italic, link, list, heading 등)
 *  - GFM (표, 체크리스트, 취소선, autolink-literal)
 *  - 코드 블록 (```언어) — prism-react-renderer로 syntax highlighting
 *  - 인라인 코드 (`code`)
 *  - LaTeX 수식 — KaTeX 렌더. 두 문법 모두 지원:
 *    · markdown 표준: `$...$` (inline) / `$$...$$` (display)
 *    · LaTeX 표준:    `\(...\)` (inline) / `\[...\]` (display)
 *    LaTeX 표준은 preprocessTexDelimiters 가 raw string 단계에서 $/$$ 로 치환.
 *    (마크다운 파서가 `\[` 를 escape로 먹어버려 AST 단계에선 늦음.)
 *
 * 금지 (rehype-sanitize):
 *  - raw HTML / SVG / iframe / script / style
 *  - javascript: / data: URL
 *
 * 외부 링크: target="_blank" + rel="noopener noreferrer" 강제.
 */
export function MessageMarkdown({ content }: { content: string }) {
  const normalized = preprocessTexDelimiters(content);
  return (
    <div className="markdown-content max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeSanitize, sanitizeSchema]]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          // 표 — 풍선(max-w-[70%])보다 넓을 수 있어 그대로 두면 풍선을 뚫고 나감.
          // overflow-x-auto wrapper로 감싸 풍선 안에서 가로 스크롤(슬라이딩)되게.
          // -mx-4 px-4 — 스크롤 영역을 풍선 좌우 padding 끝까지 확장 (GitHub/Slack 스타일).
          // 스크롤바는 wrapper 하단에 위치 — 표 직후에 붙음 (사용자 의도: 표↔스크롤바 가깝게).
          // mb-6 — 스크롤바와 다음 줄 글자 사이 24px 여유 (글자 가림 확실히 방지).
          table: ({ children, ...props }) => (
            <div className="-mx-4 mb-6 mt-2 overflow-x-auto px-4">
              <table {...props}>{children}</table>
            </div>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className ?? '');
            if (!match) {
              // 인라인 코드 — 배경/글자색을 inline style로 강제 (최고 specificity).
              // CSS class 규칙(.markdown-content code)이 cascade/cache 사유로 override돼
              // 흰 배경으로 보이는 케이스가 반복돼서, inline style로 항상 어두운 배경 보장.
              return (
                <code
                  className={className}
                  style={{
                    backgroundColor: 'rgb(30 30 30)',
                    color: 'rgb(212 212 212)',
                    padding: '0.125rem 0.3rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.85em',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            // 코드 블록 — prism으로 highlight
            const codeText = String(children).replace(/\n$/, '');
            return (
              <Highlight code={codeText} language={match[1]} theme={themes.vsDark}>
                {({
                  className: cls,
                  style,
                  tokens,
                  getLineProps,
                  getTokenProps,
                }) => (
                  <pre
                    className={`${cls} overflow-x-auto text-xs`}
                    // 패딩을 inline style로 — Tailwind class는 prism cls/style와 cascade 충돌 가능.
                    // 인라인이 무조건 이김. 좌측 32px(눈에 띄게 넓게)·우 12px·상하 12px.
                    style={{
                      ...style,
                      paddingTop: '12px',
                      paddingBottom: '12px',
                      paddingLeft: '32px',
                      paddingRight: '12px',
                    }}
                  >
                    {tokens.map((line, i) => {
                      const lineProps = getLineProps({ line });
                      return (
                        <div key={i} {...lineProps}>
                          {line.map((token, j) => {
                            const tokenProps = getTokenProps({ token });
                            return <span key={j} {...tokenProps} />;
                          })}
                        </div>
                      );
                    })}
                  </pre>
                )}
              </Highlight>
            );
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

// Placeholder 문자 — Unicode Private Use Area (U+E000~U+E001).
// 일반 키보드 입력으로 산출 불가 + 정상 콘텐츠와 충돌 가능성 사실상 0.
// fromCharCode 로 명시해 소스에서 가독성 확보 (literal PUA 문자는 invisible).
const PH_FENCE = String.fromCharCode(0xe000);
const PH_INLINE = String.fromCharCode(0xe001);

/**
 * LaTeX 표준 표기 `\(...\)`(inline) / `\[...\]`(display) 를
 * remark-math 가 인식하는 `$...$` / `$$...$$` 로 치환.
 *
 * 왜 raw string 단계인가:
 *   CommonMark 의 escape 규칙상 `\[`, `\]`, `\(`, `\)` 는 punctuation escape 로
 *   처리돼 백슬래시가 먹힘 → AST 단계엔 이미 `[` `]` `(` `)` 만 남아 늦음.
 *
 * 코드 영역 보호:
 *   fenced code block(```...```) 과 inline code(`...`) 안의 `\(...\)` 등은
 *   사용자가 의도적으로 보여주려는 텍스트 → placeholder 격리 후 복원.
 */
function preprocessTexDelimiters(content: string): string {
  const fences: string[] = [];
  const inlines: string[] = [];

  // 1) fenced code block 격리 (multi-line, non-greedy)
  let s = content.replace(/```[\s\S]*?```/g, (m) => {
    fences.push(m);
    return `${PH_FENCE}${fences.length - 1}${PH_FENCE}`;
  });

  // 2) inline code 격리 (한 줄 한정 — 코드에 newline 거의 없음)
  s = s.replace(/`[^`\n]+`/g, (m) => {
    inlines.push(m);
    return `${PH_INLINE}${inlines.length - 1}${PH_INLINE}`;
  });

  // 3) display math: \[...\] → 양옆 빈 줄과 함께 $$...$$
  //    빈 줄을 넣어주는 이유 — remark-math 가 paragraph 중간의 $$...$$ 를
  //    block math 로 인식 못 할 수 있어서 무조건 standalone block 으로 만듦.
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n\n$$${body}$$\n\n`);

  // 4) inline math: \(...\) → $...$
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`);

  // 5) 코드 영역 복원 (inline → fence 순서)
  s = s.replace(new RegExp(`${PH_INLINE}(\\d+)${PH_INLINE}`, 'g'), (_m, i) =>
    inlines[Number(i)],
  );
  s = s.replace(new RegExp(`${PH_FENCE}(\\d+)${PH_FENCE}`, 'g'), (_m, i) =>
    fences[Number(i)],
  );

  return s;
}

// rehype-sanitize 스키마 — defaultSchema 기반 + KaTeX 출력 허용 + URL 프로토콜 화이트리스트
const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
  // KaTeX가 출력하는 span/div의 className/style 허용 (수식 정렬·간격용)
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'style'],
  },
};
