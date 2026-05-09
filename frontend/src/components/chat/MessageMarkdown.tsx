'use client';

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
    <div className="prose prose-sm max-w-none break-words text-sm prose-p:my-1 prose-pre:my-2 prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none prose-headings:my-2">
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
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className ?? '');
            if (!match) {
              // 인라인 코드
              return (
                <code className={className} {...props}>
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
                    className={`${cls} overflow-x-auto rounded-lg p-3 text-xs`}
                    style={style}
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
