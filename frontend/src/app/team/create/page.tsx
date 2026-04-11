'use client';

import { useState } from 'react';

/** 팀 생성 + 기획서 작성 페이지 */
export default function CreateTeamPage() {
  const [form, setForm] = useState({
    teamName: '',
    overview: '',
    detailedPlan: '',
    schedule: '',
    projectType: '',
    expectedDuration: '',
    recruitingRoles: [] as string[],
    requiredSkills: [] as string[],
    // 선택 공개 정보
    techStack: '',
    referenceLinks: '',
    detailedSchedule: '',
    expectedOutcome: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 팀 생성 + 기획서 작성 API 호출
    console.log('팀 생성:', form);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">팀 만들기</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 기본 정보 */}
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">기본 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                팀명 *
              </label>
              <input
                type="text"
                name="teamName"
                value={form.teamName}
                onChange={handleChange}
                placeholder="팀 이름을 입력하세요"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                프로젝트 유형 *
              </label>
              <select
                name="projectType"
                value={form.projectType}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">선택하세요</option>
                <option value="project">프로젝트</option>
                <option value="hackathon">해커톤</option>
                <option value="study">스터디</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                예상 기간 *
              </label>
              <input
                type="text"
                name="expectedDuration"
                value={form.expectedDuration}
                onChange={handleChange}
                placeholder="예: 3개월"
                className="input-field"
                required
              />
            </div>
          </div>
        </section>

        {/* 필수 공개 정보 */}
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">필수 공개 정보</h2>
          <p className="mb-4 text-sm text-gray-500">
            모든 사용자에게 공개되는 정보입니다.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                프로젝트 개요 / 목표 *
              </label>
              <textarea
                name="overview"
                value={form.overview}
                onChange={handleChange}
                placeholder="프로젝트의 개요와 목표를 설명해주세요"
                className="input-field min-h-[120px]"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                진행 일정 *
              </label>
              <textarea
                name="schedule"
                value={form.schedule}
                onChange={handleChange}
                placeholder="주요 마일스톤과 일정을 작성해주세요"
                className="input-field min-h-[80px]"
                required
              />
            </div>
          </div>
        </section>

        {/* 선택 공개 정보 */}
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold">선택 공개 정보</h2>
          <p className="mb-4 text-sm text-gray-500">
            아이디어 보호를 위해 공개 여부를 직접 설정할 수 있습니다.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                상세 기획 내용
              </label>
              <textarea
                name="detailedPlan"
                value={form.detailedPlan}
                onChange={handleChange}
                placeholder="상세한 기획 내용 (지원자에게만 공개 가능)"
                className="input-field min-h-[100px]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                사용 기술 스택
              </label>
              <input
                type="text"
                name="techStack"
                value={form.techStack}
                onChange={handleChange}
                placeholder="쉼표로 구분 (예: React, Node.js, PostgreSQL)"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                예상 결과물
              </label>
              <input
                type="text"
                name="expectedOutcome"
                value={form.expectedOutcome}
                onChange={handleChange}
                placeholder="예: 웹 서비스 MVP, 모바일 앱 프로토타입"
                className="input-field"
              />
            </div>
          </div>
        </section>

        <button type="submit" className="btn-primary w-full py-3 text-lg">
          팀 등록하기
        </button>
      </form>
    </div>
  );
}
