'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// TODO: 백엔드 연동
//   - GET  /api/users/me  로 초기값 로드 (현재는 하드코딩)
//   - PUT  /api/users/me  로 저장
// (CLAUDE.md §11 TODO)

const ROLE_OPTIONS = [
  '프론트엔드',
  '백엔드',
  '풀스택',
  '모바일',
  'DevOps/인프라',
  'AI/ML',
  '데이터',
  '보안',
  'QA',
  '게임',
  '임베디드',
  'UI/UX 디자이너',
  'PM/PO',
];

/** 프로필 수정 페이지 */
export default function ProfileEditPage() {
  const router = useRouter();

  // 초기값은 일단 하드코딩 (백엔드 연동 시 GET /api/users/me 응답으로 교체)
  const [name, setName] = useState('홍길동');
  const [school, setSchool] = useState('OO대학교');
  const [department, setDepartment] = useState('컴퓨터공학과');
  const [intro, setIntro] = useState(
    '풀스택 개발에 관심이 많은 대학생입니다. 다양한 프로젝트 경험을 쌓고 싶습니다.'
  );
  const [mainRole, setMainRole] = useState('풀스택');
  const [subRoles, setSubRoles] = useState<string[]>(['프론트엔드', '백엔드']);
  const [skills, setSkills] = useState<string[]>([
    'React',
    'TypeScript',
    'Node.js',
    'Next.js',
  ]);
  const [skillInput, setSkillInput] = useState('');

  const toggleSubRole = (role: string) => {
    if (role === mainRole) return; // 메인 직군은 서브로 못 고름
    setSubRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

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

  const removeSkill = (s: string) => {
    setSkills((prev) => prev.filter((x) => x !== s));
  };

  const handleSave = () => {
    // TODO: PUT /api/users/me 호출 (현재는 mock 저장 후 바로 이동)
    router.push('/profile');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/profile"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 프로필로
          </Link>
          <h1 className="text-2xl font-bold">프로필 수정</h1>
        </div>
      </div>

      <div className="card space-y-6">
        {/* 이름 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* 학교 / 학과 */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학교</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="예: 고려대학교"
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학과</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="예: 컴퓨터공학과"
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* 한줄 소개 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            한줄 소개
          </label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* 메인 직군 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            메인 직군
          </label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setMainRole(role);
                  setSubRoles((prev) => prev.filter((r) => r !== role));
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  mainRole === role
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* 서브 직군 (다중) */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            서브 직군{' '}
            <span className="text-xs font-normal text-gray-400">
              (다중 선택 가능, 메인 직군 제외)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.filter((r) => r !== mainRole).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleSubRole(role)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  subRoles.includes(role)
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* 기술 스택 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            기술 스택
          </label>
          <div className="mb-2 flex gap-2">
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
              placeholder="기술명 입력 후 Enter (예: React)"
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={addSkill}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              추가
            </button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
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
          )}
        </div>
      </div>

      {/* 액션 */}
      <div className="mt-6 flex justify-end gap-2">
        <Link
          href="/profile"
          className="rounded-full border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          취소
        </Link>
        <button
          onClick={handleSave}
          className="rounded-full bg-blue-600 px-6 py-2.5 text-sm text-white shadow-md hover:bg-blue-700"
        >
          저장
        </button>
      </div>
    </div>
  );
}
