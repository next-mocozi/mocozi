export default function CommunityPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center justify-center px-4 py-8">
      <div className="card w-full text-center">
        <span className="inline-block bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
          오픈 예정
        </span>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">커뮤니티</h2>
        <p className="mt-4 text-base text-gray-600">
          검증된 IT 학우들과 자유롭게 네트워킹하고
          <br />
          프로젝트 인사이트를 나눌 수 있는 공간을 준비하고 있어요.
        </p>
        <p className="mt-6 text-sm text-gray-400">조금만 기다려주세요 🙌</p>
      </div>
    </div>
  );
}
