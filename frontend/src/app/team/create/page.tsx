'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

type TeamType = 'PROJECT' | 'HACKATHON' | 'STUDY' | 'COMPETITION';

const TEAM_TYPE_OPTIONS: { value: TeamType; label: string }[] = [
  { value: 'PROJECT', label: '개발 프로젝트' },
  { value: 'HACKATHON', label: '해커톤' },
  { value: 'STUDY', label: '스터디' },
  { value: 'COMPETITION', label: '공모전' },
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

/** 팀 만들기 페이지 */
export default function CreateTeamPage() {
  const router = useRouter();

  // 팀 기본 정보
  const [name, setName] = useState('');
  const [teamType, setTeamType] = useState<TeamType>('PROJECT');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recruitingRoles.length === 0) { setError('모집 직군을 1개 이상 선택해주세요.'); return; }
    if (requiredSkills.length === 0) { setError('필요 기술 스택을 1개 이상 입력해주세요.'); return; }

    setSaving(true);
    setError('');
    try {
      // 1단계: 팀 생성
      const teamRes = await api.post('/api/teams', {
        name,
        teamType,
        description: description || undefined,
        maxMembers: maxMembers ? Number(maxMembers) : undefined,
      });
      const teamId: string = teamRes.data.data.id;

      // 2단계: 기획서 등록
      await api.post(`/api/teams/${teamId}/proposal`, {
        projectName: projectName || name,
        overview,
        schedule,
        recruitingRoles,
        requiredSkills,
        referenceLinks: referenceLinks.length > 0 ? referenceLinks : undefined,
        detailedPlan: detailedPlan || undefined,
        expectedOutcome: expectedOutcome || undefined,
      });

      router.push(`/team/${teamId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || '팀 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <Link href="/team" className="mb-2 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700">
          ← 팀 목록으로
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">팀 만들기</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 기본 정보 */}
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold text-stone-800">기본 정보</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">팀명 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="팀 이름을 입력하세요"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">팀 유형 *</label>
            <div className="flex flex-wrap gap-2">
              {TEAM_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTeamType(opt.value)}
                  className={`border px-4 py-1.5 text-sm transition-all ${
                    teamType === opt.value
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              팀 소개 <span className="text-xs font-normal text-stone-400">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="팀을 한 줄로 소개해주세요"
              rows={2}
              className="input-field resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              최대 팀원 수 <span className="text-xs font-normal text-stone-400">(선택)</span>
            </label>
            <input
              type="number"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              placeholder="예: 5"
              min={1}
              max={20}
              className="input-field w-32"
            />
          </div>
        </section>

        {/* 필수 공개 정보 (기획서) */}
        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">기획서 — 필수 공개</h2>
            <p className="mt-1 text-sm text-stone-500">모든 사용자에게 공개되는 정보입니다.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">프로젝트명 *</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="팀명과 다를 경우 입력 (비우면 팀명 사용)"
              className="input-field"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">프로젝트 개요 / 목표 *</label>
            <textarea
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="프로젝트의 개요와 목표를 설명해주세요"
              rows={4}
              className="input-field resize-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">진행 일정 *</label>
            <textarea
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="예: 2026.06 ~ 2026.09 (3개월)"
              rows={2}
              className="input-field resize-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">모집 직군 *</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRecruitingRoles(toggle(role, recruitingRoles))}
                  className={`border px-3 py-1.5 text-xs transition-all ${
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

          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">필요 기술 스택 *</label>
            <div className="mb-2 flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                placeholder="직접 입력 후 Enter"
                className="flex-1 border border-stone-200 px-4 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button type="button" onClick={addSkill} className="bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">추가</button>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {SKILL_GROUPS.map(({ label, skills }) => (
                <div key={label} className="w-full">
                  <p className="mb-1 text-xs text-stone-400">{label}</p>
                  <div className="flex flex-wrap gap-1">
                    {skills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => setRequiredSkills(toggle(skill, requiredSkills))}
                        className={`border px-3 py-1 text-xs transition-all ${
                          requiredSkills.includes(skill)
                            ? 'border-stone-700 bg-stone-700 text-white'
                            : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {requiredSkills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 bg-stone-100 px-2 py-1 text-xs text-stone-700">
                    {s}
                    <button type="button" onClick={() => setRequiredSkills(requiredSkills.filter((x) => x !== s))} className="text-stone-400 hover:text-stone-700">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 선택 공개 정보 */}
        <section className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">기획서 — 선택 공개</h2>
            <p className="mt-1 text-sm text-stone-500">아이디어 보호를 위해 공개 여부를 나중에 설정할 수 있습니다.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">상세 기획 내용</label>
            <textarea
              value={detailedPlan}
              onChange={(e) => setDetailedPlan(e.target.value)}
              placeholder="상세한 기획 내용 (공개 여부 선택 가능)"
              rows={4}
              className="input-field resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">예상 결과물</label>
            <input
              type="text"
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="예: 웹 서비스 MVP, 모바일 앱 프로토타입"
              className="input-field"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">참고 링크</label>
            <div className="mb-2 flex gap-2">
              <input
                type="url"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addReference(); } }}
                placeholder="https://..."
                className="flex-1 border border-stone-200 px-4 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button type="button" onClick={addReference} className="bg-stone-600 px-4 py-2 text-sm text-white hover:bg-stone-700">추가</button>
            </div>
            {referenceLinks.length > 0 && (
              <div className="flex flex-col gap-1">
                {referenceLinks.map((url) => (
                  <span key={url} className="inline-flex items-center gap-2 bg-stone-50 px-3 py-1.5 text-xs text-stone-700">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-indigo-600 hover:underline">{url}</a>
                    <button type="button" onClick={() => setReferenceLinks(referenceLinks.filter((l) => l !== url))} className="text-stone-400 hover:text-stone-700">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3">
          <Link
            href="/team"
            className="flex-1 border border-stone-200 py-3 text-center text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-300 disabled:opacity-60"
          >
            {saving ? '등록 중...' : '팀 등록하기'}
          </button>
        </div>
      </form>
    </div>
  );
}
