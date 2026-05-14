/** "이렇게 흘러가요" 3-step 플로우. 각 step에 실제 UI를 닮은 미니 미리보기. */
export default function HowItWorks() {
  return (
    <section className="bg-stone-50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center gap-2 border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
            가입부터 첫 만남까지
          </span>
          <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">
            모코지는 이렇게 흘러가요
          </h2>
          <p className="mt-2 text-gray-600">
            복잡한 절차 없이 세 단계면 끝.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Step
            n={1}
            title="학교 메일로 인증"
            caption=".ac.kr 메일 한 번으로 가입 완료. 검증된 사람만 모이는 이유."
          >
            <Step1Preview />
          </Step>
          <Step
            n={2}
            title="기획서 보고 지원 / 팀 만들기"
            caption="필요한 직군·스킬이 정리된 기획서를 보고 지원하거나, 직접 팀을 만들어요."
          >
            <Step2Preview />
          </Step>
          <Step
            n={3}
            title="채팅으로 바로 만남"
            caption="앱 안에서 바로 대화. 첫 대면 만남까지 자연스럽게."
          >
            <Step3Preview />
          </Step>
        </div>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  caption,
  children,
}: {
  n: number;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center bg-primary-600 text-base font-bold text-white">
          {n}
        </span>
        <p className="text-lg font-bold text-stone-900">{title}</p>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-stone-600">{caption}</p>
      <div className="flex-1 border border-gray-100 bg-white p-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.07)]">
        {children}
      </div>
    </div>
  );
}

/* ---------- Step 미리보기들 ---------- */

function Step1Preview() {
  return (
    <div className="border border-gray-100 bg-white p-4">
      <p className="text-xs font-medium text-stone-500">학교 이메일</p>
      <div className="mt-1.5 flex items-center gap-2 border border-stone-200 bg-white px-3 py-2">
        <span className="text-sm text-stone-400">student@school.ac.kr</span>
      </div>
      <div
        aria-hidden="true"
        className="mt-3 w-full bg-primary-600 py-1.5 text-center text-xs font-medium text-white"
      >
        인증 메일 보내기
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-2xs text-stone-500">
        <span className="text-emerald-600">✓</span>
        본인 인증
      </p>
    </div>
  );
}

function Step2Preview() {
  return (
    <div>
      <div className="border border-gray-100 bg-white p-4">
        <div className="flex items-center gap-1.5">
          <span className="bg-emerald-100 px-2 py-0.5 text-3xs font-semibold text-emerald-700">
            모집 중
          </span>
          <span className="text-3xs text-stone-400">8주 · 11월 데모데이</span>
        </div>
        <p className="mt-2 text-sm font-bold text-stone-900">AI 헬스케어 해커톤 팀</p>
        <p className="mt-0.5 line-clamp-1 text-2xs text-stone-500">
          의료 영상 기반 진단 보조 AI 프로토타입
        </p>

        <p className="mt-3 text-3xs font-medium uppercase tracking-wider text-stone-400">
          모집 직군
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-3xs font-medium text-indigo-700">
            ML/AI
          </span>
          <span className="border border-stone-200 bg-stone-50 px-2 py-0.5 text-3xs text-stone-500">
            백엔드
          </span>
          <span className="border border-stone-200 bg-stone-50 px-2 py-0.5 text-3xs text-stone-500">
            디자인
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {['Python', 'PyTorch', 'React'].map((s) => (
            <span
              key={s}
              className="bg-stone-100 px-1.5 py-0.5 text-3xs text-stone-600"
            >
              {s}
            </span>
          ))}
        </div>

        <div
          aria-hidden="true"
          className="mt-3 w-full bg-primary-600 py-1.5 text-center text-xs font-medium text-white"
        >
          지원하기
        </div>
      </div>
      <p className="mt-2 text-center text-2xs text-stone-500">
        또는 <span className="font-medium text-primary-700">직접 팀 만들기 →</span>
      </p>
    </div>
  );
}

function Step3Preview() {
  return (
    <div className="border border-gray-100 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <span className="flex h-7 w-7 items-center justify-center bg-primary-100 text-xs font-semibold text-primary-700">
          김
        </span>
        <div>
          <p className="text-xs font-semibold text-stone-900">김OO</p>
          <p className="text-3xs text-stone-400">고려대 · 백엔드</p>
        </div>
        <span className="ml-auto h-1.5 w-1.5 bg-emerald-500" />
      </div>

      <div className="flex flex-col gap-2 px-3 py-3">
        <div className="flex justify-start">
          <span className="max-w-[80%] bg-stone-100 px-3 py-1.5 text-xs text-stone-700">
            안녕하세요! 지원 잘 봤어요 :)
          </span>
        </div>
        <div className="flex justify-end">
          <span className="max-w-[80%] bg-primary-600 px-3 py-1.5 text-xs text-white">
            내일 7시 학교 카페 어떠세요?
          </span>
        </div>
        <div className="flex justify-start">
          <span className="bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
            ☕ 커피 기프티콘 도착
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 px-3 py-2">
        <span className="flex-1 bg-stone-50 px-3 py-1 text-2xs text-stone-400">
          메시지 입력...
        </span>
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center bg-primary-600 text-white"
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
