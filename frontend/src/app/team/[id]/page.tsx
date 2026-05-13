'use client';

import { useState, useEffect, use, type ReactNode } from 'react';
import Link from 'next/link';
import { SearchIcon } from '@/components/icons/CommonIcons';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type TeamType = 'STUDY' | 'COMPETITION' | 'HACKATHON' | 'PROJECT';

const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  STUDY: '스터디',
  COMPETITION: '공모전',
  HACKATHON: '해커톤',
  PROJECT: '개발 프로젝트',
};

/** 카테고리 아이콘 — /team/page.tsx와 동일 Lucide 스타일 line-icon. 부모 색 따라감. */
const TEAM_TYPE_ICON: Record<TeamType, ReactNode> = {
  STUDY: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  COMPETITION: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  HACKATHON: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  PROJECT: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
};

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; lastName: string; firstName: string };
}

interface Proposal {
  projectName: string;
  overview: string;
  schedule: string;
  recruitingRoles: string[];
  requiredSkills: string[];
  publicFields: string[];
  detailedPlan?: string;
  expectedOutcome?: string;
  referenceLinks?: string[];
}

interface TeamDetail {
  id: string;
  name: string;
  leaderId: string;
  teamType: TeamType;
  description?: string;
  maxMembers?: number;
  isRecruiting: boolean;
  leader: { lastName: string; firstName: string };
  proposal: Proposal | null;
  members: Member[];
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-3xs font-semibold uppercase tracking-widest text-indigo-400">
      {children}
    </p>
  );
}

function VisibilityBadge({
  field,
  publicFields,
  loading,
  onToggle,
}: {
  field: string;
  publicFields: string[];
  loading: string | null;
  onToggle: (field: string) => void;
}) {
  const isPublic = publicFields.includes(field);
  const isLoading = loading === field;
  return (
    <button
      onClick={() => onToggle(field)}
      disabled={isLoading}
      className={`-mt-0.5 border px-2 py-0.5 text-3xs font-medium transition-colors disabled:opacity-50 ${
        isPublic
          ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
          : 'border-stone-200 bg-stone-50 text-stone-400 hover:bg-stone-100'
      }`}
    >
      {isLoading ? '···' : isPublic ? '공개' : '비공개'}
    </button>
  );
}

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [applyError, setApplyError] = useState('');

  const [publicFields, setPublicFields] = useState<string[]>([]);
  const [visibilityLoading, setVisibilityLoading] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/api/teams/${id}`)
      .then((res) => {
        const data = res.data.data;
        setTeam(data);
        setPublicFields(data.proposal?.publicFields ?? []);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleVisibility = async (field: string) => {
    const next = publicFields.includes(field)
      ? publicFields.filter((f) => f !== field)
      : [...publicFields, field];
    setVisibilityLoading(field);
    try {
      await api.patch(`/api/teams/${id}/proposal/visibility`, { publicFields: next });
      setPublicFields(next);
    } finally {
      setVisibilityLoading(null);
    }
  };

  const handleApply = async () => {
    if (!applyMsg.trim()) { setApplyError('지원 메시지를 입력해주세요.'); return; }
    setApplying(true);
    setApplyError('');
    try {
      await api.post(`/api/apply/${id}`, { message: applyMsg });
      setApplyDone(true);
      setApplyOpen(false);
      setApplyMsg('');
    } catch (err: any) {
      setApplyError(err.response?.data?.message || '지원에 실패했습니다.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-stone-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (notFound || !team) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6 lg:px-8">
        <div className="flex h-16 w-16 items-center justify-center bg-stone-100 text-stone-400">
          <SearchIcon className="h-9 w-9" />
        </div>
        <p className="text-lg font-semibold text-stone-800">존재하지 않는 팀입니다</p>
        <p className="text-sm text-stone-400">삭제되었거나 잘못된 주소일 수 있어요.</p>
        <Link
          href="/team"
          className="mt-1 border border-indigo-200 px-6 py-2.5 text-sm font-medium text-indigo-600 transition-all hover:bg-indigo-600 hover:text-white"
        >
          팀 목록으로
        </Link>
      </div>
    );
  }

  const isLeader = user?.id === team.leaderId;
  const isMember = team.members.some((m) => m.userId === user?.id);
  const memberCount = team.members.length;
  const maxMembers = team.maxMembers;

  const applyButtonContent = () => {
    if (applyDone) return { label: '지원 완료 ✓', disabled: true };
    if (isLeader) return { label: '내 팀입니다', disabled: true };
    if (isMember) return { label: '이미 팀원입니다', disabled: true };
    if (!team.isRecruiting) return { label: '모집이 완료된 팀입니다', disabled: true };
    return { label: '지원하기', disabled: false };
  };
  const applyBtn = applyButtonContent();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6 lg:px-8 lg:pb-8">
      <Link
        href="/team"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        팀 목록
      </Link>

      {/* 헤더 */}
      <div
        className={`relative overflow-hidden px-6 py-8 text-white shadow-lg sm:px-8 sm:py-10 ${
          !team.isRecruiting
            ? 'bg-gradient-to-br from-stone-500 via-stone-600 to-stone-700'
            : 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700'
        }`}
      >
        {/* 배경 장식 원 */}
        <div className="pointer-events-none absolute rounded-full -right-12 -top-12 h-48 w-48 bg-white/5" />
        <div className="pointer-events-none absolute rounded-full -bottom-8 right-24 h-32 w-32 bg-white/5" />
        <div className="pointer-events-none absolute rounded-full left-1/2 top-4 h-24 w-24 bg-white/5" />

        <div className="relative">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              {TEAM_TYPE_ICON[team.teamType]} {TEAM_TYPE_LABEL[team.teamType]}
            </span>
            <span
              className={`px-3 py-1 text-xs font-medium ${
                team.isRecruiting
                  ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30'
                  : 'bg-stone-400/20 text-stone-200 border border-stone-400/30'
              }`}
            >
              {team.isRecruiting ? '● 모집 중' : '모집 완료'}
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{team.name}</h1>
          {team.description && (
            <p className="mt-2 text-white/75 text-sm leading-relaxed">{team.description}</p>
          )}
          <p className="mt-3 text-xs text-white/50">팀장 · {team.leader.lastName + team.leader.firstName}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* 좌측: 기획서 */}
        <div className="space-y-5 lg:col-span-2">
          {team.proposal ? (
            <>
              {/* 기획서 메인 카드 */}
              <div className="card space-y-5">
                <h2 className="text-base font-semibold text-stone-800">기획서</h2>

                <div className="border-b border-stone-50 pb-5">
                  <FieldLabel>프로젝트명</FieldLabel>
                  <p className="text-stone-800 font-medium">{team.proposal.projectName}</p>
                </div>

                <div className="border-b border-stone-50 pb-5">
                  <FieldLabel>프로젝트 개요 / 목표</FieldLabel>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                    {team.proposal.overview}
                  </p>
                </div>

                <div className={team.proposal.expectedOutcome || team.proposal.detailedPlan ? 'border-b border-stone-50 pb-5' : ''}>
                  <FieldLabel>진행 일정</FieldLabel>
                  <p className="text-sm text-stone-700">{team.proposal.schedule}</p>
                </div>

                {team.proposal.expectedOutcome && (
                  <div className={team.proposal.detailedPlan ? 'border-b border-stone-50 pb-5' : ''}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <p className="text-3xs font-semibold uppercase tracking-widest text-indigo-400">예상 결과물</p>
                      {isLeader && (
                        <VisibilityBadge
                          field="expectedOutcome"
                          publicFields={publicFields}
                          loading={visibilityLoading}
                          onToggle={toggleVisibility}
                        />
                      )}
                    </div>
                    <p className="text-sm text-stone-700">{team.proposal.expectedOutcome}</p>
                  </div>
                )}

                {team.proposal.detailedPlan && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <p className="text-3xs font-semibold uppercase tracking-widest text-indigo-400">상세 기획</p>
                      {isLeader && (
                        <VisibilityBadge
                          field="detailedPlan"
                          publicFields={publicFields}
                          loading={visibilityLoading}
                          onToggle={toggleVisibility}
                        />
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                      {team.proposal.detailedPlan}
                    </p>
                  </div>
                )}
              </div>

              {/* 참고 링크 */}
              {team.proposal.referenceLinks && team.proposal.referenceLinks.length > 0 && (
                <div className="card">
                  <div className="flex items-center gap-2">
                    <FieldLabel>참고 링크</FieldLabel>
                    {isLeader && (
                      <VisibilityBadge
                        field="referenceLinks"
                        publicFields={publicFields}
                        loading={visibilityLoading}
                        onToggle={toggleVisibility}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {team.proposal.referenceLinks.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 border border-indigo-100 bg-indigo-50/50 px-4 py-2.5 text-sm text-indigo-600 transition-colors hover:bg-indigo-100"
                      >
                        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span className="truncate">{url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 모집 직군 */}
              <div className="card">
                <FieldLabel>모집 직군</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {team.proposal.recruitingRoles.map((role) => (
                    <span
                      key={role}
                      className="border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              {/* 기술 스택 */}
              <div className="card">
                <FieldLabel>필요 기술 스택</FieldLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {team.proposal.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-600"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card flex items-center gap-3 text-stone-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">등록된 기획서가 없습니다.</p>
            </div>
          )}
        </div>

        {/* 우측: 팀원 + 지원 */}
        <div className="space-y-4">
          {/* 팀원 카드 */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-stone-800">팀원</h2>
              <span className="bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
                {memberCount}{maxMembers ? `/${maxMembers}` : ''}명
              </span>
            </div>

            <div className="space-y-1">
              {team.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/profile/${m.userId}`}
                  className="flex items-center gap-3 px-2 py-2 transition-colors hover:bg-indigo-50/60"
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center text-sm font-semibold ${
                      m.role === 'LEADER'
                        ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {m.user.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-800">{m.user.lastName + m.user.firstName}</p>
                    <p className={`text-xs ${m.role === 'LEADER' ? 'text-indigo-500' : 'text-stone-400'}`}>
                      {m.role === 'LEADER' ? '팀장' : '팀원'}
                    </p>
                  </div>
                </Link>
              ))}

              {maxMembers &&
                Array.from({ length: maxMembers - memberCount }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-3 px-2 py-2 opacity-40">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border-2 border-dashed border-stone-300 text-stone-400 text-lg">
                      +
                    </div>
                    <p className="text-sm text-stone-400">빈 자리</p>
                  </div>
                ))}
            </div>
          </div>

          {/* 팀장 전용 버튼 */}
          {isLeader && (
            <div className="flex flex-col gap-2">
              <Link
                href={`/team/${id}/edit`}
                className="flex w-full items-center justify-center gap-2 border border-stone-200 py-3 text-sm font-medium text-stone-600 transition-all hover:bg-stone-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                팀 정보 수정
              </Link>
              <Link
                href={`/team/${id}/applications`}
                className="flex w-full items-center justify-center gap-2 border border-indigo-200 py-3 text-sm font-medium text-indigo-600 transition-all hover:bg-indigo-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                지원자 목록 보기
              </Link>
            </div>
          )}

          {/* 지원 버튼 — 데스크톱은 사이드바, 모바일은 화면 하단 sticky 바로 분리 */}
          <div className="hidden lg:block">
            {applyBtn.disabled ? (
              <button
                disabled
                className="w-full cursor-not-allowed bg-stone-100 py-3.5 text-sm font-semibold text-stone-400"
              >
                {applyBtn.label}
              </button>
            ) : (
              <Link
                href={`/chat?teamId=${team.id}&context=RECRUIT_TEAM`}
                className="block w-full bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-center text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-300"
              >
                {applyBtn.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 sticky 지원 CTA — lg 이상에선 사이드바 버튼이 대신함 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm lg:hidden">
        {applyBtn.disabled ? (
          <button
            disabled
            className="w-full cursor-not-allowed bg-stone-100 py-3.5 text-sm font-semibold text-stone-400"
          >
            {applyBtn.label}
          </button>
        ) : (
          <Link
            href={`/chat?teamId=${team.id}&context=RECRUIT_TEAM`}
            className="block w-full bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-center text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-300 active:scale-[0.99]"
          >
            {applyBtn.label}
          </Link>
        )}
      </div>

      {/* 지원 모달 */}
      {applyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => { setApplyOpen(false); setApplyError(''); }}
        >
          <div
            className="w-full max-w-md bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-bold text-stone-900">지원하기</h2>
              <p className="mt-1 text-sm text-stone-400">
                <span className="font-medium text-indigo-600">{team.name}</span>에 보낼 메시지를 작성해주세요.
              </p>
            </div>

            <textarea
              value={applyMsg}
              onChange={(e) => setApplyMsg(e.target.value)}
              placeholder="자기소개, 지원 이유, 기여할 수 있는 부분 등을 자유롭게 작성해주세요."
              rows={5}
              className="input-field resize-none text-sm"
            />
            {applyError && (
              <p className="mt-2 text-xs text-red-500">{applyError}</p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setApplyOpen(false); setApplyError(''); }}
                className="flex-1 border border-stone-200 py-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                취소
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg disabled:opacity-60"
              >
                {applying ? '제출 중...' : '지원 제출'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
