'use client';

import { useState } from 'react';
import Link from 'next/link';

/** 구인 게시판 페이지 */
export default function RecruitListPage() {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">구인 게시판</h1>
        <Link href="/team/create" className="btn-primary">
          팀 등록하기
        </Link>
      </div>

      {/* 필터/검색 영역 */}
      <div className="card mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="키워드로 검색..."
            className="input-field"
          />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="input-field"
          >
            <option value="">전체 직군</option>
            <option value="FRONTEND">프론트엔드</option>
            <option value="BACKEND">백엔드</option>
            <option value="FULLSTACK">풀스택</option>
            <option value="DESIGNER">디자이너</option>
            <option value="PM">기획자/PM</option>
            <option value="AI_ML">AI/ML</option>
            <option value="DATA">데이터</option>
            <option value="DEVOPS">DevOps</option>
          </select>
          <select
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            className="input-field"
          >
            <option value="">전체 기술</option>
            <option value="React">React</option>
            <option value="Next.js">Next.js</option>
            <option value="TypeScript">TypeScript</option>
            <option value="Node.js">Node.js</option>
            <option value="Spring">Spring</option>
            <option value="Python">Python</option>
            <option value="Figma">Figma</option>
          </select>
        </div>
      </div>

      {/* 게시글 카드 그리드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 플레이스홀더 카드 */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Link key={i} href={`/recruit/${i}`} className="card transition-shadow hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                모집 중
              </span>
              <span className="text-xs text-gray-500">2024.03.15 마감</span>
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              프로젝트 팀원 모집합니다 #{i}
            </h3>
            <p className="mb-3 text-sm text-gray-600">
              함께 웹 서비스를 만들 팀원을 찾습니다. 열정 있는 분 환영!
            </p>
            <div className="mb-2 flex flex-wrap gap-1">
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                React
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                TypeScript
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                Node.js
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>프론트엔드</span>
              <span>·</span>
              <span>백엔드</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
