import Link from 'next/link';

/** 랜딩 페이지 */
export default function HomePage() {
  return (
    <div>
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">
            IT 대학생을 위한
            <br />
            <span className="text-primary-600">팀 빌딩 플랫폼</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600">
            대학교 메일 인증 기반의 신뢰할 수 있는 프로젝트/해커톤/스터디 구인
            서비스
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/register" className="btn-primary px-8 py-3 text-lg">
              시작하기
            </Link>
            <Link href="/recruit" className="btn-secondary px-8 py-3 text-lg">
              구인 둘러보기
            </Link>
          </div>
        </div>
      </section>

      {/* 주요 기능 소개 */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            주요 기능
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* 구인 */}
            <div className="card text-center">
              <div className="mb-4 text-4xl">🔍</div>
              <h3 className="mb-2 text-xl font-semibold">구인/지원</h3>
              <p className="text-gray-600">
                스킬, 직군, 학교 등 조건별로 세분화된 검색으로 딱 맞는 팀을
                찾으세요
              </p>
            </div>
            {/* 기획서 */}
            <div className="card text-center">
              <div className="mb-4 text-4xl">📝</div>
              <h3 className="mb-2 text-xl font-semibold">기획서 시스템</h3>
              <p className="text-gray-600">
                정형화된 기획서로 팀을 소개하고, 공개 범위 설정으로 아이디어를
                보호하세요
              </p>
            </div>
            {/* 포트폴리오 */}
            <div className="card text-center">
              <div className="mb-4 text-4xl">💼</div>
              <h3 className="mb-2 text-xl font-semibold">포트폴리오</h3>
              <p className="text-gray-600">
                활동 유형별 카드로 나를 표현하고, 도메인 태그로 전문성을
                어필하세요
              </p>
            </div>
            {/* 채팅 */}
            <div className="card text-center">
              <div className="mb-4 text-4xl">💬</div>
              <h3 className="mb-2 text-xl font-semibold">실시간 채팅</h3>
              <p className="text-gray-600">
                서비스 내 실시간 채팅으로 팀원과 빠르게 소통하세요
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="bg-primary-600 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white">
            지금 바로 팀을 만들어보세요
          </h2>
          <p className="mt-4 text-primary-100">
            대학교 메일 인증 한 번으로 시작할 수 있습니다
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-primary-600 transition-colors hover:bg-primary-50"
          >
            무료로 시작하기
          </Link>
        </div>
      </section>
    </div>
  );
}
