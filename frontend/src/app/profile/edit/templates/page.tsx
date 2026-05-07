'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { MessageContext, MessageTemplate } from '@/types/chat';

/**
 * 채팅 첫 메시지 양식 편집 페이지.
 *
 * 탭 구조:
 *  - 개인 구인용 (RECRUIT_INDIVIDUAL)
 *  - 팀 지원용 (RECRUIT_TEAM)
 *
 * 사용 가능한 placeholder는 사이드 패널에서 클릭으로 입력란에 삽입.
 */

const TABS: { context: MessageContext; label: string; description: string }[] = [
  {
    context: 'RECRUIT_INDIVIDUAL',
    label: '개인 구인용',
    description: '구인 페이지에서 다른 사용자에게 채팅 시작 시 사용되는 양식',
  },
  {
    context: 'RECRUIT_TEAM',
    label: '팀 지원용',
    description: '팀 상세 페이지에서 지원하기 클릭 시 사용되는 양식',
  },
];

const PLACEHOLDERS: { token: string; description: string }[] = [
  { token: '{senderName}', description: '내 이름' },
  { token: '{recipientName}', description: '받는 사람 이름' },
  { token: '{role}', description: '지원 직군 (팀 지원용만 — 직군 선택 단계에서)' },
  { token: '{teamName}', description: '팀 이름 (팀 지원용만)' },
  { token: '{senderId}', description: '내 사용자 ID — 보통 attachment 마커에서 사용' },
  { token: '{profileUrl}', description: '내 프로필 페이지 URL' },
];

const ATTACHMENT_HINT = '[[link:profile:{senderId}|{senderName}의 프로필 보기]]';

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<MessageContext>('RECRUIT_INDIVIDUAL');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 탭 변경 시 양식 fetch
  useEffect(() => {
    setLoading(true);
    setError(null);
    setSavedAt(null);
    api
      .get<{ data: MessageTemplate }>(`/api/templates?context=${activeTab}`)
      .then((res) => setContent(res.data.data.content))
      .catch(() => {
        setError('양식을 불러오지 못했습니다.');
        setContent('');
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.put('/api/templates', { context: activeTab, content });
      setSavedAt(new Date());
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (saving) return;
    if (!confirm('이 양식을 삭제하면 다음 사용 시 자동 합성된 default로 돌아갑니다. 계속할까요?')) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/api/templates/${activeTab}`);
      // 삭제 후 GET으로 default 다시 받음
      const res = await api.get<{ data: MessageTemplate }>(
        `/api/templates?context=${activeTab}`,
      );
      setContent(res.data.data.content);
      setSavedAt(new Date());
    } catch {
      setError('초기화에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const insertPlaceholder = (token: string) => {
    const ta = document.getElementById('template-content') as HTMLTextAreaElement | null;
    if (!ta) return setContent((prev) => prev + token);
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    setContent(content.slice(0, start) + token + content.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + token.length;
      ta.setSelectionRange(newPos, newPos);
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">채팅 첫 메시지 양식</h1>
      <p className="mt-1 text-sm text-gray-600">
        컨텍스트별로 미리 만들어둔 양식이 채팅방 첫 진입 시 양식 카드로 노출됩니다.
      </p>

      {/* 탭 */}
      <div className="mt-6 flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.context}
            type="button"
            onClick={() => setActiveTab(t.context)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.context
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        {TABS.find((t) => t.context === activeTab)?.description}
      </p>

      {/* 메인 영역 — 좌: 편집 / 우: placeholder 가이드 */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
              불러오는 중…
            </div>
          ) : (
            <textarea
              id="template-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-mono leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="양식을 입력하세요…"
            />
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              기본값으로 초기화
            </button>
            {savedAt && !error && (
              <span className="text-xs text-green-600">
                ✓ {savedAt.toLocaleTimeString()} 저장됨
              </span>
            )}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>

        {/* placeholder 가이드 */}
        <aside className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-800">사용 가능한 변수</h3>
          <p className="mt-1 text-xs text-gray-500">
            클릭하면 커서 위치에 삽입됩니다.
          </p>
          <ul className="mt-3 space-y-2">
            {PLACEHOLDERS.map((p) => (
              <li key={p.token}>
                <button
                  type="button"
                  onClick={() => insertPlaceholder(p.token)}
                  className="rounded bg-white px-2 py-1 text-xs font-mono text-primary-700 shadow-sm hover:bg-primary-50"
                >
                  {p.token}
                </button>
                <span className="ml-2 text-xs text-gray-600">{p.description}</span>
              </li>
            ))}
          </ul>

          <h3 className="mt-5 text-sm font-semibold text-gray-800">
            첨부 링크 (선택)
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            메시지 끝에 둥근사각형 버튼으로 표시됩니다.
          </p>
          <button
            type="button"
            onClick={() => insertPlaceholder(`\n\n${ATTACHMENT_HINT}`)}
            className="mt-2 rounded bg-white px-2 py-1 text-xs font-mono text-primary-700 shadow-sm hover:bg-primary-50"
          >
            프로필 첨부
          </button>
        </aside>
      </div>
    </div>
  );
}
