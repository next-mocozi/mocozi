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
 *  - LaTeX 수식 ($...$ / $$...$$) — KaTeX 렌더
 *
 * 금지 (rehype-sanitize):
 *  - raw HTML / SVG / iframe / script / style
 *  - javascript: / data: URL
 *
 * 외부 링크: target="_blank" + rel="noopener noreferrer" 강제.
 */
export function MessageMarkdown({ content }: { content: string }) {
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
                    className={`${cls} overflow-x-auto rounded-lg text-xs`}
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
        {content}
      </ReactMarkdown>
    </div>
  );
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
