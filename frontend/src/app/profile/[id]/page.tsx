/** 다른 사용자 프로필 페이지 */
export default function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 요약 */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-3xl text-primary-600">
            👤
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">사용자 #{params.id}</h1>
            <p className="text-gray-600">OO대학교 소프트웨어학과</p>
            <p className="mt-2 text-sm text-gray-500">
              백엔드 개발을 주로 하고 있습니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                Java
              </span>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                Spring
              </span>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600">
                PostgreSQL
              </span>
            </div>
          </div>
          <button className="btn-primary text-sm">채팅하기</button>
        </div>
      </div>

      {/* 포트폴리오 */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">포트폴리오</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                활동
              </span>
              <span className="text-xs text-gray-500">2024.01 - 현재</span>
            </div>
            <h3 className="mb-1 font-semibold">오픈소스 컨트리뷰톤</h3>
            <p className="text-sm text-gray-600">
              오픈소스 프로젝트에 기여한 활동입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
