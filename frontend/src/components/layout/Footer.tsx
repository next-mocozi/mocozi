/** 공통 푸터 */
export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} 모코지 (Mocozi). All rights reserved.</p>
        <p className="mt-1">
          IT계열 대학생을 위한 팀 빌딩 플랫폼 ·{' '}
          <a
            href="https://elated-yttrium-040.notion.site/35fb74b939b180acbf68f7ae92b6f8bf?pvs=73"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 hover:underline"
          >
            개인정보처리방침
          </a>
        </p>
      </div>
    </footer>
  );
}
