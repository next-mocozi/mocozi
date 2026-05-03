'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type TeamType = 'STUDY' | 'COMPETITION' | 'HACKATHON' | 'PROJECT';

const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  STUDY: '스터디',
  COMPETITION: '공모전',
  HACKATHON: '해커톤',
  PROJECT: '개발 프로젝트',
};

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string };
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
  leader: { name: string };
  proposal: Proposal | null;
  members: Member[];
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

  useEffect(() => {
    api
      .get(`/api/teams/${id}`)
      .then((res) => setTeam(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

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
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (notFound || !team) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <p className="text-lg font-semibold">존재하지 않는 팀입니다</p>
        <p className="text-sm text-gray-500">삭제되었거나 잘못된 주소일 수 있어요.</p>
        <Link
          href="/team"
          className="mt-2 rounded-full border border-blue-200 px-5 py-2 text-sm text-blue-600 transition-all hover:bg-blue-600 hover:text-white"
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
    if (applyDone) return { label: '지원 완료', disabled: true };
    if (isLeader) return { label: '내 팀입니다', disabled: true };
    if (isMember) return { label: '이미 팀원입니다', disabled: true };
    if (!team.isRecruiting) return { label: '모집 완료된 팀입니다', disabled: true };
    return { label: '지원하기', disabled: false };
  };
  const applyBtn = applyButtonContent();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/team"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 팀 목록
      </Link>

      {/* 헤더 */}
      <div
        className={`relative overflow-hidden rounded-2xl px-8 py-10 text-white shadow-md ${
          !team.isRecruiting
            ? 'bg-gradient-to-br from-gray-400 to-gray-600'
            : 'bg-gradient-to-br from-blue-500 to-blue-700'
        }`}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            {TEAM_TYPE_LABEL[team.teamType]}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !team.isRecruiting
                ? 'bg-gray-200 text-gray-600'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {team.isRecruiting ? '모집 중' : '모집 완료'}
          </span>
        </div>
        <h1 className="text-3xl font-bold">{team.name}</h1>
        {team.description && (
          <p className="mt-2 text-white/90">{team.description}</p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* 좌측: 기획서 */}
        <div className="space-y-6 lg:col-span-2">
          {team.proposal ? (
            <>
              <div className="card space-y-4">
                <h2 className="text-lg font-semibold">기획서</h2>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">프로젝트명</p>
                  <p className="text-gray-800">{team.proposal.projectName}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">프로젝트 개요 / 목표</p>
                  <p className="whitespace-pre-wrap text-gray-800">{team.proposal.overview}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">진행 일정</p>
                  <p className="text-gray-800">{team.proposal.schedule}</p>
                </div>
                {team.proposal.expectedOutcome && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">예상 결과물</p>
                    <p className="text-gray-800">{team.proposal.expectedOutcome}</p>
                  </div>
                )}
                {team.proposal.detailedPlan && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">상세 기획</p>
                    <p className="whitespace-pre-wrap text-gray-800">{team.proposal.detailedPlan}</p>
                  </div>
                )}
                {team.proposal.referenceLinks && team.proposal.referenceLinks.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500">참고 링크</p>
                    <div className="flex flex-col gap-1">
                      {team.proposal.referenceLinks.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm text-blue-600 hover:underline"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="mb-3 text-lg font-semibold">모집 직군</h2>
                <div className="flex flex-wrap gap-2">
                  {team.proposal.recruitingRoles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-blue-600 px-4 py-1.5 text-sm text-white"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2 className="mb-3 text-lg font-semibold">기술 스택</h2>
                <div className="flex flex-wrap gap-2">
                  {team.proposal.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <p className="text-sm text-gray-500">등록된 기획서가 없습니다.</p>
            </div>
          )}
        </div>

        {/* 우측: 팀원 + 지원 */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold">
              팀원{' '}
              <span className="text-sm font-normal text-gray-500">
                ({memberCount}{maxMembers ? `/${maxMembers}` : ''}명)
              </span>
            </h2>
            <div className="space-y-3">
              {team.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/profile/${m.userId}`}
                  className="flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-gray-50"
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      m.role === 'LEADER'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {m.user.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.user.name}</p>
                    <p className={`text-xs ${m.role === 'LEADER' ? 'text-blue-500' : 'text-gray-400'}`}>
                      {m.role === 'LEADER' ? '팀장' : '팀원'}
                    </p>
                  </div>
                </Link>
              ))}
              {maxMembers &&
                Array.from({ length: maxMembers - memberCount }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-3 opacity-40">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400">
                      +
                    </div>
                    <p className="text-sm text-gray-400">빈 자리</p>
                  </div>
                ))}
            </div>
          </div>

          {isLeader && (
            <Link
              href={`/team/${id}/applications`}
              className="block w-full rounded-full border border-blue-600 py-3 text-center text-sm text-blue-600 hover:bg-blue-50"
            >
              지원자 목록 보기
            </Link>
          )}

          <button
            disabled={applyBtn.disabled}
            onClick={() => !applyBtn.disabled && setApplyOpen(true)}
            className={`w-full rounded-full py-3 text-sm font-medium shadow-md transition-all ${
              applyBtn.disabled
                ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {applyBtn.label}
          </button>
        </div>
      </div>

      {/* 지원 모달 */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold">지원하기</h2>
            <p className="mb-4 text-sm text-gray-500">{team.name}에 지원 메시지를 작성해주세요.</p>
            <textarea
              value={applyMsg}
              onChange={(e) => setApplyMsg(e.target.value)}
              placeholder="자기소개, 지원 이유, 기여할 수 있는 부분 등을 자유롭게 작성해주세요."
              rows={5}
              className="input-field resize-none"
            />
            {applyError && <p className="mt-2 text-sm text-red-500">{applyError}</p>}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setApplyOpen(false); setApplyError(''); }}
                className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
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
