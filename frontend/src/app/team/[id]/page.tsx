/** 팀 상세 페이지 */
export default function TeamDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 팀 헤더 */}
      <div className="card mb-6">
        <h1 className="mb-2 text-2xl font-bold">프로젝트 팀 #{params.id}</h1>
        <p className="text-gray-600">
          함께 멋진 서비스를 만들어가는 팀입니다.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 기획서 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold">기획서</h2>
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-500">
                  프로젝트 개요
                </h3>
                <p className="text-gray-700">
                  IT 대학생을 위한 네트워킹 플랫폼 개발 프로젝트입니다.
                </p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-500">
                  진행 일정
                </h3>
                <p className="text-gray-700">2024.03 - 2024.06 (3개월)</p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-500">
                  구인 직군
                </h3>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded bg-blue-50 px-2 py-1 text-sm text-blue-600">
                    프론트엔드
                  </span>
                  <span className="rounded bg-blue-50 px-2 py-1 text-sm text-blue-600">
                    백엔드
                  </span>
                  <span className="rounded bg-blue-50 px-2 py-1 text-sm text-blue-600">
                    디자이너
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 구인 게시글 */}
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold">구인 게시글</h2>
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="font-medium">프론트엔드 개발자 모집</h3>
              <p className="mt-1 text-sm text-gray-600">
                React, TypeScript 경험자를 찾습니다.
              </p>
              <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                모집 중
              </span>
            </div>
          </div>
        </div>

        {/* 팀원 목록 */}
        <div>
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold">팀원 (3/5명)</h2>
            <div className="space-y-3">
              {['팀장', '프론트엔드', '백엔드'].map((role, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm text-primary-600">
                    👤
                  </div>
                  <div>
                    <p className="text-sm font-medium">팀원 {i + 1}</p>
                    <p className="text-xs text-gray-500">{role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
