'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

type PortfolioItemType = 'PROJECT' | 'RESEARCH' | 'ACTIVITY' | 'ETC';

const TYPE_META: Record<PortfolioItemType, { label: string; bg: string; text: string }> = {
  PROJECT: { label: '프로젝트', bg: 'bg-purple-100', text: 'text-purple-700' },
  RESEARCH: { label: '연구', bg: 'bg-blue-100', text: 'text-blue-700' },
  ACTIVITY: { label: '활동', bg: 'bg-green-100', text: 'text-green-700' },
  ETC: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-700' },
};

const TAB_ORDER: PortfolioItemType[] = ['PROJECT', 'RESEARCH', 'ACTIVITY', 'ETC'];

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
  roles?: string[];
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

  const [activeTab, setActiveTab] = useState<PortfolioItemType>('PROJECT');

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

  const items = profile?.portfolio?.items ?? [];
  const availableTabs = TAB_ORDER.filter((t) => items.some((it) => it.type === t));

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

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
          className="btn-secondary mt-2 text-sm"
        >
          홈으로
        </Link>
      </div>
    );
  }

  const gradeLabel = profile.grade
    ? /^\d+$/.test(profile.grade) ? `${profile.grade}학년` : profile.grade
    : null;

  const mainRole = profile.roles?.[0];
  const subRoles = profile.roles?.slice(1) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 요약 */}
      <div className="mb-6 flex items-start gap-6">
        <div className="flex h-31 w-31 items-center justify-center rounded-full bg-primary-100 text-4xl font-bold text-primary-600">
          {profile.name[0]}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.name}</h1>
          </div>
          <p className="text-gray-600">
            {profile.university} {profile.department}
            {gradeLabel && (
              <span className="ml-1 text-sm text-gray-400">
                · {gradeLabel}
              </span>
            )}
          </p>

          {/* 직군 */}
          {(mainRole || subRoles.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {mainRole && (
                <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                  {mainRole}
                </span>
              )}
              {subRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
                >
                  {role}
                </span>
              ))}
            </div>
          )}

          {/* 기술 스택 */}
          {profile.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
        <Link
          href={`/chat?userId=${id}&context=RECRUIT_INDIVIDUAL`}
          className="btn-primary text-sm"
        >
          채팅하기
        </Link>
      </div>

      {/* 한 줄 소개 */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">한 줄 소개</h2>
        {profile.bio ? (
          <p className="font-medium whitespace-pre-wrap break-words">{profile.bio}</p>
        ) : (
          <p className="text-sm text-gray-500">아직 등록된 한 줄 소개가 없습니다.</p>
        )}
      </div>

      {/* 경력 요약 */}
      {profile.careerSummary && (
        <div className="card mb-6">
          <h2 className="mb-4 text-lg font-semibold">경력 요약</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-gray-700">
            {profile.careerSummary}
          </p>
        </div>
      )}

      {/* 포트폴리오 */}
      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2>
          <p className="mt-1 text-sm text-gray-500">
            {profile.name}님이 등록한 포트폴리오 항목입니다.
          </p>
        </div>

        {availableTabs.length === 0 ? (
          <div className="card py-10 text-center text-sm text-gray-400">
            등록된 포트폴리오가 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {/* 세그먼트 컨트롤 */}
            <div
              role="tablist"
              aria-label="포트폴리오 섹션"
              className="inline-flex flex-wrap gap-1 rounded-2xl bg-gray-100 p-1"
            >
              {availableTabs.map((t) => {
                const isActive = activeTab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(t)}
                    className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {TYPE_META[t].label}
                  </button>
                );
              })}
            </div>

            {/* 활성 탭 컨텐츠 */}
            <SectionCardList
              userId={profile.id}
              items={items.filter((it) => it.type === activeTab)}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function SectionCardList({
  userId,
  items,
}: {
  userId: string;
  items: PortfolioItem[];
}) {
  return (
    <div className="card">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">등록된 항목이 없습니다.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const meta = TYPE_META[item.type];
            return (
              <Link
                key={item.id}
                href={`/portfolio/${userId}/items/${item.id}`}
                className="block rounded-xl border border-gray-100 p-3 transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                  {item.domain && (
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                      {item.domain}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{item.duration}</span>
                </div>
                <h4 className="mb-1 text-sm font-semibold text-gray-900">
                  {item.title}
                </h4>
                {item.description && (
                  <p className="mb-2 line-clamp-2 text-xs text-gray-600">
                    {item.description}
                  </p>
                )}
                {item.role && (
                  <p className="text-xs text-gray-500">역할: {item.role}</p>
                )}
                {item.techStack.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.techStack.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {item.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-xs text-blue-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
