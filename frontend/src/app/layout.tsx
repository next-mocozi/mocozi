import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/providers/SocketProvider';
import { ToastContainer } from '@/components/chat/ToastContainer';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '모코지 - IT 대학생 팀 빌딩 플랫폼',
  description:
    'IT계열 대학생을 위한 프로젝트/해커톤/스터디 구인 및 네트워킹 플랫폼',
};

/** 루트 레이아웃 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <SocketProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <ToastContainer />
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
