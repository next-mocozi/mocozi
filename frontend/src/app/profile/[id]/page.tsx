'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type PortfolioItemType = 'PROJECT' | 'RESEARCH' | 'ACTIVITY' | 'ETC';

const ITEM_TYPE_LABEL: Record<PortfolioItemType, string> = {
  PROJECT: '프로젝트',
  RESEARCH: '연구/논문',
  ACTIVITY: '활동',
  ETC: '기타',
};

const ITEM_TYPE_CLASS: Record<PortfolioItemType, string> = {
  PROJECT: 'bg-blue-100 text-blue-700',
  RESEARCH: 'bg-purple-100 text-purple-700',
  ACTIVITY: 'bg-green-100 text-green-700',
  ETC: 'bg-gray-100 text-gray-600',
};

interface PortfolioItem {
  id: string;
  type: PortfolioItemType;
  title: string;
  description: string;
  techStack: string[];
  duration: string;
  role: string;
  domain: string;
  tags: string[];
}

interface UserProfile {
  id: string;
  name: string;
  university: string;
  department: string;
  grade: string | null;
  bio: string | null;
  skills: string[];
  careerSummary: string | null;
  portfolio: { items: PortfolioItem[] } | null;
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (me?.id === id) {
      router.replace('/profile');
      return;
    }
    api
      .get(`/api/users/${id}`)
      .then((res) => setProfile(res.data.data))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id, me?.id, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <p className="text-lg font-semibold">존재하지 않는 사용자입니다</p>
        <p className="text-sm text-gray-500">삭제되었거나 잘못된 주소일 수 있어요.</p>
        <Link
          href="/"
          className="mt-2 rounded-full border border-blue-200 px-5 py-2 text-sm text-blue-600 hover:bg-blue-600 hover:text-white"
        >
          홈으로
        </Link>
      </div>
    );
  }

  const gradeLabel = profile.grade
    ? /^\d+$/.test(profile.grade) ? `${profile.grade}학년` : profile.grade
    : null;

  const items = profile.portfolio?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 헤더 */}
      <div className="card mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-600">
            {profile.name[0]}
          </div>

          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{profile.name}</h1>
            </div>
            <p className="text-sm text-gray-500">
              {profile.university} · {profile.department}
              {gradeLabel && ` · ${gradeLabel}`}
            </p>

            {profile.bio && (
              <p className="mt-3 text-sm text-gray-700">{profile.bio}</p>
            )}

            {profile.careerSummary && (
              <p className="mt-2 text-sm text-gray-600">{profile.careerSummary}</p>
            )}

            {profile.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <span key={s} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Link
            href={`/chat?userId=${id}`}
            className="flex-shrink-0 rounded-full bg-blue-600 px-5 py-2 text-sm text-white shadow-md hover:bg-blue-700"
          >
            채팅하기
          </Link>
        </div>
      </div>

      {/* 포트폴리오 */}
      <h2 className="mb-4 text-lg font-semibold">포트폴리오</h2>
      {items.length === 0 ? (
        <div className="card py-10 text-center text-sm text-gray-400">
          등록된 포트폴리오가 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ITEM_TYPE_CLASS[item.type]}`}>
                  {ITEM_TYPE_LABEL[item.type]}
                </span>
                <span className="text-xs text-gray-400">{item.duration}</span>
              </div>

              <h3 className="font-semibold">{item.title}</h3>

              <p className="text-sm text-gray-600">{item.description}</p>

              {item.role && (
                <p className="text-xs text-gray-500">역할: {item.role}</p>
              )}

              {item.techStack.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.techStack.map((t) => (
                    <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span key={tag} className="text-xs text-blue-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
