'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type TeamType = 'PROJECT' | 'HACKATHON' | 'STUDY' | 'COMPETITION';

const TEAM_TYPE_OPTIONS: { value: TeamType; label: string; emoji: string }[] = [
  { value: 'PROJECT', label: '개발 프로젝트', emoji: '🚀' },
  { value: 'HACKATHON', label: '해커톤', emoji: '⚡' },
  { value: 'STUDY', label: '스터디', emoji: '📚' },
  { value: 'COMPETITION', label: '공모전', emoji: '🏆' },
];

const ROLE_OPTIONS = [
  '프론트엔드', '백엔드', '풀스택', '모바일', 'DevOps/인프라',
  'AI/ML', '데이터', '보안', 'QA', '게임', '임베디드', 'UI/UX 디자이너', 'PM/PO',
];

const SKILL_GROUPS = [
  { label: '프론트엔드', skills: ['React', 'Next.js', 'Vue.js', 'TypeScript', 'JavaScript', 'Tailwind CSS'] },
  { label: '백엔드', skills: ['Node.js', 'NestJS', 'Spring Boot', 'Python', 'FastAPI', 'Go'] },
  { label: '모바일', skills: ['React Native', 'Flutter', 'Swift', 'Android'] },
  { label: '데이터베이스', skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis'] },
  { label: 'DevOps', skills: ['AWS', 'Docker', 'Kubernetes', 'Linux'] },
  { label: 'AI/데이터', skills: ['TensorFlow', 'PyTorch', 'Pandas', 'LangChain'] },
];

const toggle = (item: string, list: string[]) =>
  list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

function SectionHeader({
  number,
  title,
  subtitle,
  icon,
}: {
  number: number;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center bg-indigo-600 text-xs font-bold text-white">
        {number}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-stone-800">{title}</h2>
          {icon}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldLabel({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-stone-700">
      {children}
      {required && <span className="ml-1 text-indigo-500">*</span>}
    </label>
  );
}

export default function EditTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [hasProposal, setHasProposal] = useState(false);

  // 팀 기본 정보
  const [name, setName] = useState('');
  const [teamType, setTeamType] = useState<TeamType>('PROJECT');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [isRecruiting, setIsRecruiting] = useState(true);

  // 기획서 — 필수 공개
  const [projectName, setProjectName] = useState('');
  const [overview, setOverview] = useState('');
  const [schedule, setSchedule] = useState('');
  const [recruitingRoles, setRecruitingRoles] = useState<string[]>([]);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  // 기획서 — 선택 공개
  const [detailedPlan, setDetailedPlan] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    api
      .get(`/api/teams/${id}`)
      .then((res) => {
        const team = res.data.data;

        if (!user || team.leaderId !== user.id) {
          router.replace(`/team/${id}`);
          return;
        }

        setName(team.name);
        setTeamType(team.teamType);
        setDescription(team.description ?? '');
        setMaxMembers(team.maxMembers?.toString() ?? '');
        setIsRecruiting(team.isRecruiting);

        if (team.proposal) {
          setHasProposal(true);
          setProjectName(team.proposal.projectName);
          setOverview(team.proposal.overview);
          setSchedule(team.proposal.schedule);
          setRecruitingRoles(team.proposal.recruitingRoles);
          setRequiredSkills(team.proposal.requiredSkills);
          setDetailedPlan(team.proposal.detailedPlan ?? '');
          setExpectedOutcome(team.proposal.expectedOutcome ?? '');
          setReferenceLinks(team.proposal.referenceLinks ?? []);
        }
      })
      .catch(() => router.replace(`/team/${id}`))
      .finally(() => setLoading(false));
  }, [id, authLoading, router]);

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || requiredSkills.includes(v)) { setSkillInput(''); return; }
    setRequiredSkills((prev) => [...prev, v]);
    setSkillInput('');
  };

  const addReference = () => {
    const v = referenceInput.trim();
    if (!v) return;
    try { new URL(v); } catch { setError('올바른 URL을 입력해주세요.'); return; }
    if (referenceLinks.includes(v)) { setReferenceInput(''); return; }
    setReferenceLinks((prev) => [...prev, v]);
    setReferenceInput('');
    setError('');
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/teams/${id}`);
      router.replace('/team');
    } catch (err: any) {
      setError(err.response?.data?.message || '팀 삭제에 실패했습니다.');
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recruitingRoles.length === 0) { setError('모집 직군을 1개 이상 선택해주세요.'); return; }
    if (requiredSkills.length === 0) { setError('필요 기술 스택을 1개 이상 입력해주세요.'); return; }

    setSaving(true);
    setError('');

    try {
      await api.patch(`/api/teams/${id}`, {
        name,
        teamType,
        description: description || undefined,
        maxMembers: maxMembers ? Number(maxMembers) : undefined,
        isRecruiting,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || '팀 기본 정보 저장에 실패했습니다.');
      setSaving(false);
      return;
    }

    try {
      const proposalData = {
        projectName: projectName || name,
        overview,
        schedule,
        recruitingRoles,
        requiredSkills,
        referenceLinks: referenceLinks.length > 0 ? referenceLinks : undefined,
        detailedPlan: detailedPlan || undefined,
        expectedOutcome: expectedOutcome || undefined,
      };

      if (hasProposal) {
        await api.patch(`/api/teams/${id}/proposal`, proposalData);
      } else {
        await api.post(`/api/teams/${id}/proposal`, proposalData);
      }
    } catch (err: any) {
      setError('팀 기본 정보는 저장됐지만 기획서 저장에 실패했습니다. 다시 시도해주세요.');
      setSaving(false);
      return;
    }

    router.push(`/team/${id}`);
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 페이지 헤더 */}
      <div className="mb-6 sm:mb-8">
        <Link
          href={`/team/${id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          팀 상세로
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl md:text-4xl">팀 정보 수정</h1>
        <p className="mt-1 text-sm text-stone-400">변경한 내용은 즉시 반영됩니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ① 기본 정보 */}
        <section className="card">
          <SectionHeader number={1} title="기본 정보" />

          <div className="space-y-4">
            <div>
              <FieldLabel required>팀명</FieldLabel>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <FieldLabel required>팀 유형</FieldLabel>
              <div className="grid grid-cols-2 gap-1 border border-stone-200 bg-stone-100 p-1 sm:inline-flex">
                {TEAM_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTeamType(opt.value)}
                    className={`whitespace-nowrap px-3.5 py-2 text-sm font-medium transition-all ${
                      teamType === opt.value
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    <span className="mr-1.5">{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>
                팀 소개{' '}
                <span className="ml-1 text-xs font-normal text-stone-400">(선택)</span>
              </FieldLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="팀을 한 줄로 소개해주세요."
                className="input-field resize-none"
              />
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <div>
                <FieldLabel>
                  최대 팀원 수{' '}
                  <span className="ml-1 text-xs font-normal text-stone-400">(선택)</span>
                </FieldLabel>
                <input
                  type="number"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  min={1}
                  max={20}
                  placeholder="—"
                  className="input-field w-28"
                />
              </div>

              <div>
                <FieldLabel>모집 상태</FieldLabel>
                <div className="inline-flex border border-stone-200 bg-stone-100 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setIsRecruiting(true)}
                    className={`px-4 py-1.5 text-sm font-medium transition-all ${
                      isRecruiting
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    모집 중
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRecruiting(false)}
                    className={`px-4 py-1.5 text-sm font-medium transition-all ${
                      !isRecruiting
                        ? 'bg-white text-stone-600 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    모집 완료
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ② 기획서 — 필수 공개 */}
        <section className="card">
          <SectionHeader
            number={2}
            title="기획서 — 필수 공개"
            subtitle="모든 사용자에게 공개되는 정보입니다."
            icon={
              <span className="bg-emerald-100 px-2 py-0.5 text-3xs font-medium text-emerald-700">
                공개
              </span>
            }
          />

          <div className="space-y-4">
            <div>
              <FieldLabel>프로젝트명</FieldLabel>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="팀명과 다를 경우 입력 (비우면 팀명 사용)"
                className="input-field"
              />
            </div>

            <div>
              <FieldLabel required>프로젝트 개요 / 목표</FieldLabel>
              <textarea
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                rows={4}
                placeholder="어떤 문제를 해결하려 하나요? 핵심 목표는 무엇인가요?"
                className="input-field resize-none"
                required
              />
            </div>

            <div>
              <FieldLabel required>진행 일정</FieldLabel>
              <textarea
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="예: 2026.06 ~ 2026.09 (3개월)"
                rows={2}
                className="input-field resize-none"
                required
              />
            </div>

            {/* 모집 직군 */}
            <div>
              <FieldLabel required>모집 직군</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRecruitingRoles(toggle(role, recruitingRoles))}
                    className={`border px-3.5 py-1.5 text-xs font-medium transition-all ${
                      recruitingRoles.includes(role)
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* 기술 스택 */}
            <div>
              <FieldLabel required>필요 기술 스택</FieldLabel>

              {/* 직접 입력 */}
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                  placeholder="목록에 없으면 직접 입력 후 Enter"
                  className="flex-1 border border-stone-200 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-stone-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  추가
                </button>
              </div>

              {/* 카테고리별 스킬 선택 */}
              <div className="space-y-3 border border-stone-100 bg-stone-50 p-4">
                {SKILL_GROUPS.map(({ label, skills }) => (
                  <div key={label}>
                    <p className="mb-1.5 text-3xs font-semibold uppercase tracking-widest text-stone-400">
                      {label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => setRequiredSkills(toggle(skill, requiredSkills))}
                          className={`border px-3 py-1 text-xs font-medium transition-all ${
                            requiredSkills.includes(skill)
                              ? 'border-stone-800 bg-stone-800 text-white'
                              : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-100'
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 선택된 스킬 표시 */}
              {requiredSkills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {requiredSkills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => setRequiredSkills(requiredSkills.filter((x) => x !== s))}
                        className="text-stone-400 transition-colors hover:text-stone-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ③ 기획서 — 선택 공개 */}
        <section className="card">
          <SectionHeader
            number={3}
            title="기획서 — 선택 공개"
            subtitle="공개 여부를 나중에 별도로 설정할 수 있습니다. 아이디어를 보호하세요."
            icon={
              <span className="bg-amber-100 px-2 py-0.5 text-3xs font-medium text-amber-700">
                선택 공개
              </span>
            }
          />

          <div className="space-y-4">
            <div>
              <FieldLabel>상세 기획 내용</FieldLabel>
              <textarea
                value={detailedPlan}
                onChange={(e) => setDetailedPlan(e.target.value)}
                rows={4}
                placeholder="구체적인 기능 명세, 기술 아키텍처, 단계별 로드맵 등을 적어주세요."
                className="input-field resize-none"
              />
            </div>

            <div>
              <FieldLabel>예상 결과물</FieldLabel>
              <input
                type="text"
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                placeholder="예: 웹 서비스 MVP, 모바일 앱 프로토타입"
                className="input-field"
              />
            </div>

            <div>
              <FieldLabel>참고 링크</FieldLabel>
              <div className="mb-2 flex gap-2">
                <input
                  type="url"
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReference(); } }}
                  placeholder="https://..."
                  className="flex-1 border border-stone-200 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-stone-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={addReference}
                  className="bg-stone-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  추가
                </button>
              </div>
              {referenceLinks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {referenceLinks.map((url) => (
                    <span
                      key={url}
                      className="flex items-center gap-2 border border-stone-100 bg-stone-50 px-4 py-2.5 text-xs"
                    >
                      <svg className="h-3.5 w-3.5 flex-shrink-0 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate text-indigo-600 hover:underline"
                      >
                        {url}
                      </a>
                      <button
                        type="button"
                        onClick={() => setReferenceLinks(referenceLinks.filter((l) => l !== url))}
                        className="text-stone-400 transition-colors hover:text-stone-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-2 border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex gap-3 pt-1">
          <Link
            href={`/team/${id}`}
            className="flex-1 border border-stone-200 py-3.5 text-center text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </form>

      {/* 위험 구역 */}
      <div className="mt-8 border border-red-100 p-5">
        <p className="mb-1 text-sm font-semibold text-red-600">팀 삭제</p>
        <p className="mb-4 text-xs text-stone-400">
          팀을 삭제하면 기획서·지원 내역이 모두 영구 삭제됩니다. 되돌릴 수 없습니다.
        </p>
        {!deleteConfirm ? (
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="border border-red-200 px-5 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            팀 삭제
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500">정말 삭제하시겠습니까?</span>
            <button
              type="button"
              onClick={() => setDeleteConfirm(false)}
              className="border border-stone-200 px-4 py-1.5 text-sm text-stone-500 transition-colors hover:bg-stone-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
            >
              {deleting ? '삭제 중...' : '삭제 확인'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
