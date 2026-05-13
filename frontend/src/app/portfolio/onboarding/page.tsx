'use client';

// useSearchParams 사용 — Next.js 16 정적 prerender 가 Suspense 없이는 거부하므로
// 페이지 자체에 force-dynamic + Inner 컴포넌트를 Suspense 로 감싸는 패턴.
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { updateMyMeta } from '@/lib/portfolio-api';
import { notifyPortfolioChanged } from '@/hooks/useMyPortfolioStatus';
import { invalidateMyPortfolio } from '@/hooks/useMyPortfolio';
import {
  FIRST_POST_STORAGE_KEY,
  INTRO_MAX,
  INTRO_STORAGE_KEY,
  OWNER_STORAGE_KEY,
  VISIBILITY_STORAGE_KEY,
  type PortfolioVisibility,
} from '../_lib';

// 기술 스택 추천 칩 — /profile/edit 의 SKILL_GROUPS 와 동일한 구성으로
// 별도 입력 도움. 직접 입력도 가능.
const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  {
    label: '프론트엔드',
    skills: [
      'React',
      'Next.js',
      'Vue.js',
      'TypeScript',
      'JavaScript',
      'Tailwind CSS',
    ],
  },
  {
    label: '백엔드',
    skills: ['Node.js', 'NestJS', 'Spring Boot', 'Java', 'Python', 'FastAPI', 'Go'],
  },
  {
    label: '모바일',
    skills: ['React Native', 'Flutter', 'Swift', 'Kotlin'],
  },
  {
    label: '데이터/AI',
    skills: ['Pandas', 'PyTorch', 'TensorFlow', 'OpenAI API', 'SQL'],
  },
  {
    label: '디자인/툴',
    skills: ['Figma', 'Git', 'Docker', 'AWS'],
  },
];

/** 포트폴리오 미작성 사용자를 위한 가이드 + 첫 작성 폼.
 *  자기소개(1자 이상) + 기술 스택(1개 이상)을 충족해야 저장 후 본인 상세로 이동.
 *  이미 작성한 사용자는 /portfolio 로 리다이렉트(피드 노출). */
export default function PortfolioOnboardingPage() {
  // useSearchParams 가 Inner 안에 있으므로 Suspense 로 감싸 prerender 호환.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-gray-400">로딩 중…</p>
        </div>
      }
    >
      <PortfolioOnboardingPageInner />
    </Suspense>
  );
}

function PortfolioOnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, refreshUser } = useAuth();

  // ?edit=1 또는 ?edit=true 로 진입 시 "수정 모드".
  //  - 이미 작성한 사용자도 redirect 안 하고 폼 표시 (FeedDetailPanel 의 ProfilePost
  //    "프로필 수정" 메뉴가 이쪽으로 보냄).
  //  - 기존 intro / skills 를 폼에 채워서 그대로 수정 가능.
  //  - 저장 후 visibility 모달 거치지 않고 바로 본인 portfolio 로 이동.
  const editMode =
    searchParams.get('edit') === '1' || searchParams.get('edit') === 'true';

  const [intro, setIntro] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // 폼 저장 직후 띄울 공개/비공개 선택 모달 상태.
  // null 이면 모달 미노출. 값이 있으면 사용자가 모달에서 라디오 선택 후 확인 대기.
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [pickedVisibility, setPickedVisibility] =
    useState<PortfolioVisibility>('public');
  const [finalizing, setFinalizing] = useState(false);

  // 비로그인 → 로그인 페이지. 이미 작성됨 → 피드 (단 edit 모드면 redirect 안 함).
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (editMode) return; // 수정 모드는 redirect 우회
    if (saving || showVisibilityModal || finalizing) return;
    try {
      const existingIntro = localStorage.getItem(INTRO_STORAGE_KEY) ?? '';
      const skillsCount = user.skills?.length ?? 0;
      if (existingIntro.trim().length >= 1 && skillsCount >= 1) {
        router.replace('/portfolio');
      }
    } catch {
      // localStorage 실패 시 그냥 폼 표시
    }
  }, [loading, user, router, saving, showVisibilityModal, finalizing, editMode]);

  // 신규 모드: 폼 빈 상태로 시작.
  // 수정 모드: 기존 intro (user.bio / localStorage) + 기술스택 (user.skills) prefill.
  useEffect(() => {
    if (!user) return;
    if (editMode) {
      let existingIntro = '';
      try {
        existingIntro = localStorage.getItem(INTRO_STORAGE_KEY) ?? '';
      } catch {
        // 무시
      }
      setIntro(existingIntro || user.bio || '');
      setSkills(user.skills ?? []);
    } else {
      setSkills([]);
    }
  }, [user?.id, editMode]);

  const toggleSkill = (s: string) =>
    setSkills((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v) return;
    if (skills.includes(v)) {
      setSkillInput('');
      return;
    }
    setSkills((prev) => [...prev, v]);
    setSkillInput('');
  };

  const removeSkill = (s: string) =>
    setSkills((prev) => prev.filter((x) => x !== s));

  const handleSubmit = async () => {
    if (!user) return;
    const trimmed = intro.trim();
    if (trimmed.length < 1) {
      setError('자기소개를 1자 이상 입력해주세요.');
      return;
    }
    if (skills.length < 1) {
      setError('기술 스택을 1개 이상 선택하거나 입력해주세요.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      // 1) 자기소개(bio) + skills 백엔드 저장. 기존엔 user.bio(옛 값)를 그대로 보내서
      //    새로 입력한 intro 가 백엔드에 반영되지 않는 버그가 있었음 → trimmed 로 변경.
      await api.put('/api/users/me', {
        name: user.name,
        university: user.university,
        department: user.department,
        grade: user.grade,
        bio: trimmed,
        skills,
      });
      // 2) 포트폴리오 intro 백엔드 저장 + localStorage 캐시
      await updateMyMeta({ intro: trimmed }).catch(() => {});
      localStorage.setItem(INTRO_STORAGE_KEY, trimmed);
      localStorage.setItem(OWNER_STORAGE_KEY, user.id);
      await refreshUser();
      // 3) 수정 모드면 visibility 모달 건너뛰고 본인 portfolio 로 바로 이동.
      //    (이미 한 번 onboarding 거친 사용자라 visibility 도 이미 set 되어 있음.)
      if (editMode) {
        notifyPortfolioChanged();
        router.replace(`/portfolio/${user.id}`);
        return;
      }
      // 신규 모드 — 공개/비공개 선택 모달 노출
      setShowVisibilityModal(true);
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmVisibility = async () => {
    if (!user) return;
    setFinalizing(true);
    try {
      const firstPostAt = new Date();
      localStorage.setItem(VISIBILITY_STORAGE_KEY, pickedVisibility);
      // 첫 게시물 timestamp — 메인 피드/내 피드의 ProfilePost 정렬 기준
      localStorage.setItem(FIRST_POST_STORAGE_KEY, String(firstPostAt.getTime()));
      // 백엔드에 visibility + firstPostAt 동기화 (실패해도 localStorage로 폴백)
      try {
        await updateMyMeta({
          isPublic: pickedVisibility === 'public',
          firstPostAt: firstPostAt.toISOString(),
        });
      } catch {
        // 무시 — localStorage 만으로도 동작
      }
      notifyPortfolioChanged();
      await invalidateMyPortfolio(); // stale 캐시 제거 — 피드 진입 시 ProfilePost 카드 즉시 표시
      router.replace(`/portfolio/${user.id}`);
    } catch {
      setError('설정 저장에 실패했습니다.');
      setFinalizing(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="card">
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl">📝</div>
          <h1 className="text-2xl font-bold text-gray-900">
            포트폴리오를 만들어보세요!
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            자기소개와 기술 스택만 입력하면 다른 사람들의 포트폴리오를 둘러볼
            수 있어요.
            <br />
            나머지(실무 경험, 프로젝트 등)는 언제든 추가할 수 있습니다.
          </p>
        </div>

        {/* 자기소개 */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-800">
              자기소개 <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-xs ${
                intro.length >= INTRO_MAX
                  ? 'text-red-500'
                  : intro.length >= INTRO_MAX * 0.9
                    ? 'text-amber-500'
                    : 'text-gray-400'
              }`}
            >
              {intro.length} / {INTRO_MAX}
            </span>
          </div>
          <textarea
            value={intro}
            onChange={(e) => {
              setIntro(e.target.value.slice(0, INTRO_MAX));
              if (error) setError('');
            }}
            maxLength={INTRO_MAX}
            rows={4}
            placeholder="자신을 짧게 소개해주세요. (최대 500자)"
            className="block w-full resize-none border border-gray-200 px-4 py-3 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </section>

        {/* 기술 스택 */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-800">
              기술 스택 <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400">
              {skills.length}개 선택됨
            </span>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            추천 칩을 클릭해 추가하거나, 직접 입력 후 Enter 로 추가할 수 있어요.
          </p>

          {/* 직접 입력 */}
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="예: React"
              className="flex-1 border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={addSkill}
              className="bg-blue-600 px-4 py-2 text-sm text-white shadow-sm hover:bg-blue-700"
            >
              추가
            </button>
          </div>

          {/* 추천 칩 */}
          <div className="space-y-3">
            {SKILL_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-xs font-semibold text-gray-500">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.skills.map((s) => {
                    const active = skills.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSkill(s)}
                        className={`px-3 py-1 text-xs font-medium transition-all ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 선택된 칩 */}
          {skills.length > 0 && (
            <div className="mt-4 bg-blue-50/40 p-3">
              <p className="mb-2 text-xs font-semibold text-blue-700">
                선택된 기술 스택
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 bg-white px-2 py-1 text-xs text-blue-600 shadow-sm ring-1 ring-blue-100"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="text-blue-400 hover:text-blue-700"
                      aria-label={`${s} 제거`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {error && (
          <p className="mb-4 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            나중에 만들기
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '저장 중…' : '포트폴리오 만들기'}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          저장 후 공개/비공개를 한 번 더 선택할 수 있어요. 본인 페이지에서
          언제든 다시 바꿀 수 있습니다.
        </p>
      </div>

      {/* ─────── 공개/비공개 선택 모달 ─────── */}
      {showVisibilityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-visibility-title"
        >
          <div className="w-full max-w-md overflow-hidden bg-white shadow-xl">
            <div className="px-6 pt-6 text-center">
              <div className="mb-2 text-3xl">🎉</div>
              <h2
                id="onboarding-visibility-title"
                className="text-xl font-bold text-gray-900"
              >
                피드에 오신 걸 환영합니다!
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                방금 만든 포트폴리오를 다른 사람들에게도 공유할까요?
                <br />
                언제든 본인 페이지에서 다시 바꿀 수 있어요.
              </p>
            </div>

            <div className="space-y-3 px-6 pt-5">
              <button
                type="button"
                onClick={() => setPickedVisibility('public')}
                className={`w-full border p-4 text-left transition-all ${
                  pickedVisibility === 'public'
                    ? 'border-blue-400 bg-blue-50/60'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">공개</p>
                  {pickedVisibility === 'public' && (
                    <span className="text-sm text-blue-600">✓ 선택됨</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  다른 사람들의 피드에 내 포트폴리오 게시물이 노출돼요.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPickedVisibility('private')}
                className={`w-full border p-4 text-left transition-all ${
                  pickedVisibility === 'private'
                    ? 'border-blue-400 bg-blue-50/60'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">비공개</p>
                  {pickedVisibility === 'private' && (
                    <span className="text-sm text-blue-600">✓ 선택됨</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  본인만 볼 수 있어요. 다른 사람의 피드에는 노출되지 않습니다.
                </p>
              </button>
            </div>

            {/* 유의사항 */}
            <div className="mx-6 mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              <span className="mr-1" aria-hidden>
                💡
              </span>
              공개를 선택하면 방금 입력한 자기소개와 기술 스택이{' '}
              <strong>첫 게시물</strong>로 피드에 올라갑니다.
            </div>

            <div className="px-6 py-5">
              <button
                type="button"
                onClick={handleConfirmVisibility}
                disabled={finalizing}
                className="w-full bg-blue-600 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finalizing ? '저장 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
