'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getMaskedName } from '@/lib/utils';

/**
 * §B-DM-8 RoomList 인라인 액션 — 기획서/프로필 미리보기 패널.
 *
 * mode === 'team-proposal':
 *   GET /api/teams/{targetId} 로 팀 + proposal 가져와 핵심 필드만 노출.
 *   필수 공개 부분만 보여줌 (백엔드가 publicFields로 이미 필터링).
 * mode === 'user-profile':
 *   GET /api/users/{targetId} 로 사용자 기본 정보 + skills 노출.
 *
 * 둘 다 "자세히 보기" 링크를 하단에 두어 정식 페이지로 이동 가능.
 *
 * 부모(RoomList)에서 `open`/`onClose` 제어. 우측에서 슬라이드 인하는 가벼운 패널.
 */

interface RoomPreviewPanelProps {
  mode: 'team-proposal' | 'user-profile';
  targetId: string;
  open: boolean;
  onClose: () => void;
}

interface TeamPreview {
  id: string;
  name: string;
  description?: string | null;
  leader?: { lastName: string; firstName: string };
  proposal?: {
    title?: string | null;
    summary?: string | null;
    detailedPlan?: string | null;
    expectedOutcome?: string | null;
  } | null;
  _count?: { members: number };
}

interface UserPreview {
  id: string;
  lastName: string;
  firstName: string;
  university?: string | null;
  department?: string | null;
  bio?: string | null;
  skills?: string[];
  roles?: string[];
  profileImage?: string | null;
}

export function RoomPreviewPanel({
  mode,
  targetId,
  open,
  onClose,
}: RoomPreviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamPreview | null>(null);
  const [profile, setProfile] = useState<UserPreview | null>(null);

  useEffect(() => {
    if (!open || !targetId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTeam(null);
    setProfile(null);

    const url =
      mode === 'team-proposal'
        ? `/api/teams/${targetId}`
        : `/api/users/${targetId}`;

    api
      .get<{ data: TeamPreview | UserPreview }>(url)
      .then((res) => {
        if (cancelled) return;
        if (mode === 'team-proposal') {
          setTeam(res.data.data as TeamPreview);
        } else {
          setProfile(res.data.data as UserPreview);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? '불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode, targetId]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const detailLink =
    mode === 'team-proposal' ? `/team/${targetId}` : `/profile/${targetId}`;

  return (
    <>
      {/* 배경 dim — 클릭 시 닫기 */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      {/* 패널 — 우측에서 슬라이드 */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-stone-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'team-proposal' ? '팀 기획서 미리보기' : '프로필 미리보기'}
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 className="text-base font-bold text-stone-900">
            {mode === 'team-proposal' ? '기획서 미리보기' : '프로필 미리보기'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="닫기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <p className="text-center text-sm text-stone-500">불러오는 중...</p>
          )}
          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
          {!loading && !error && team && (
            <div className="space-y-3 text-sm text-stone-700">
              <div>
                <p className="text-xs text-stone-500">팀 이름</p>
                <p className="text-base font-semibold text-stone-900">{team.name}</p>
              </div>
              {team.leader && (
                <div>
                  <p className="text-xs text-stone-500">팀장</p>
                  <p>{getMaskedName(team.leader)}</p>
                </div>
              )}
              {typeof team._count?.members === 'number' && (
                <div>
                  <p className="text-xs text-stone-500">멤버 수</p>
                  <p>{team._count.members}명</p>
                </div>
              )}
              {team.description && (
                <div>
                  <p className="text-xs text-stone-500">소개</p>
                  <p className="whitespace-pre-wrap text-sm">{team.description}</p>
                </div>
              )}
              {team.proposal?.title && (
                <div>
                  <p className="text-xs text-stone-500">기획안 제목</p>
                  <p className="font-semibold">{team.proposal.title}</p>
                </div>
              )}
              {team.proposal?.summary && (
                <div>
                  <p className="text-xs text-stone-500">요약</p>
                  <p className="whitespace-pre-wrap text-sm">{team.proposal.summary}</p>
                </div>
              )}
              {team.proposal?.detailedPlan && (
                <div>
                  <p className="text-xs text-stone-500">상세 계획</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {team.proposal.detailedPlan.length > 400
                      ? `${team.proposal.detailedPlan.slice(0, 400)}...`
                      : team.proposal.detailedPlan}
                  </p>
                </div>
              )}
            </div>
          )}
          {!loading && !error && profile && (
            <div className="space-y-3 text-sm text-stone-700">
              <div className="flex items-center gap-3">
                {profile.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.profileImage}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-600">
                    {profile.lastName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-base font-semibold text-stone-900">{getMaskedName(profile)}</p>
                  {(profile.university || profile.department) && (
                    <p className="text-xs text-stone-500">
                      {[profile.university, profile.department].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              {profile.bio && (
                <div>
                  <p className="text-xs text-stone-500">소개</p>
                  <p className="whitespace-pre-wrap text-sm">{profile.bio}</p>
                </div>
              )}
              {profile.skills && profile.skills.length > 0 && (
                <div>
                  <p className="text-xs text-stone-500">기술 스택</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {profile.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.roles && profile.roles.length > 0 && (
                <div>
                  <p className="text-xs text-stone-500">관심 직군</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {profile.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-stone-200 p-3">
          <Link
            href={detailLink}
            onClick={onClose}
            className="block w-full rounded-lg bg-indigo-600 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
          >
            자세히 보기
          </Link>
        </footer>
      </aside>
    </>
  );
}
