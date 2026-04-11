'use client';

/** 내 프로필 페이지 */
export default function MyProfilePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 요약 */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          {/* 프로필 이미지 */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-3xl text-primary-600">
            👤
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">홍길동</h1>
            <p className="text-gray-600">OO대학교 컴퓨터공학과</p>
            <p className="mt-2 text-sm text-gray-500">
              풀스택 개발에 관심이 많은 대학생입니다. 다양한 프로젝트 경험을
              쌓고 싶습니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                React
              </span>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                TypeScript
              </span>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                Node.js
              </span>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                Next.js
              </span>
            </div>
          </div>
          <button className="btn-secondary text-sm">프로필 수정</button>
        </div>
      </div>

      {/* 경력 요약 */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">경력 요약</h2>
        <p className="text-gray-600">
          아직 등록된 경력 요약이 없습니다. 프로필을 수정하여 추가해보세요.
        </p>
      </div>

      {/* 포트폴리오 카드 리스트 */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">포트폴리오</h2>
          <button className="btn-primary text-sm">새 항목 추가</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* 플레이스홀더 카드 */}
          <div className="card">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                프로젝트
              </span>
              <span className="text-xs text-gray-500">2024.01 - 2024.03</span>
            </div>
            <h3 className="mb-1 font-semibold">웹 포트폴리오 사이트</h3>
            <p className="mb-2 text-sm text-gray-600">
              개인 포트폴리오 웹사이트를 제작했습니다.
            </p>
            <div className="flex flex-wrap gap-1">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Next.js
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Tailwind
              </span>
            </div>
          </div>

          {/* 빈 상태 안내 */}
          <div className="card flex items-center justify-center border-dashed text-center text-gray-400">
            <div>
              <div className="mb-2 text-3xl">+</div>
              <p className="text-sm">새 포트폴리오 항목 추가</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
