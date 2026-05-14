'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScoutModal } from '@/components/chat/ScoutModal';
import { UserIcon } from '@/components/icons/ChatIcons';
import api from '@/lib/api';
import { startDirectChat } from '@/lib/chat/startDirectChat';
import { useAuth } from '@/hooks/useAuth';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type ProfileLink,
} from '../_platforms';
import { getBannerGradientClass } from '../_banner';

type PortfolioItemType = 'PROJECT' | 'RESEARCH' | 'STUDY' | 'ACTIVITY' | 'ETC';

const TYPE_META: Record<PortfolioItemType, { label: string; bg: string; text: string }> = {
  PROJECT: { label: '프로젝트', bg: 'bg-purple-100', text: 'text-purple-700' },
  RESEARCH: { label: '연구', bg: 'bg-blue-100', text: 'text-blue-700' },
  STUDY: { label: '스터디', bg: 'bg-amber-100', text: 'text-amber-700' },
  ACTIVITY: { label: '활동', bg: 'bg-green-100', text: 'text-green-700' },
  ETC: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-700' },
};

type SectionKey =
  | 'intro'
  | 'experiences'
  | 'careers'
  | 'projects'
  | 'research'
  | 'studies';

const SECTION_ORDER: SectionKey[] = [
  'intro',
  'experiences',
  'careers',
  'projects',
  'research',
  'studies',
];

const SECTION_LABEL: Record<SectionKey, string> = {
  intro: '자기소개',
  experiences: '실무 경험 & 이력',
  careers: '경력 요약',
  projects: '프로젝트',
  research: '연구',
  studies: '스터디',
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

interface WorkExperience {
  id: string;
  company: string;
  team: string | null;
  role: string;
  period: string;
  current: boolean;
}

interface Activity {
  id: string;
  year: string;
  month: string | null;
  content: string;
}

interface PortfolioLink {
  id: string;
  url: string;
  label: string | null;
}

interface UserProfile {
  id: string;
  lastName: string;
  firstName: string;
  university: string;
  department: string;
  grade: string | null;
  bio: string | null;
  skills: string[];
  roles?: string[];
  careerSummary: string | null;
  /** 작성자가 본인 프로필에서 선택한 배너 색상. 타인 viewer 도 동일하게 보여야. */
  bannerColor?: string | null;
  portfolio: {
    intro: string | null;
    profileSections: string[];
    items: PortfolioItem[];
    workExperiences: WorkExperience[];
    activities: Activity[];
    links: PortfolioLink[];
  } | null;
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

  const [activeTab, setActiveTab] = useState<SectionKey | null>(null);

  /** §B-DM-8 — 스카우트 모달 열림 상태. 버튼 클릭 시 셋, 모달 onClose에서 null. */
  const [scoutOpen, setScoutOpen] = useState(false);

  /** "채팅하기" — 일반 DIRECT 대화. context 없이 생성하므로 RoomList 색 점은 안 뜬다. */
  const [chatStarting, setChatStarting] = useState(false);

  const handleStartChat = async () => {
    if (!profile || chatStarting) return;
    setChatStarting(true);
    try {
      const roomId = await startDirectChat(profile.id);
      router.push(`/chat/${roomId}`);
    } catch {
      setChatStarting(false);
      window.alert('채팅방을 여는 데 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

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

  const rawLinks = profile.portfolio?.links ?? [];
  const links: ProfileLink[] = rawLinks.map((l) => ({ id: l.id, url: l.url, label: l.label ?? undefined }));

  const intro = profile.portfolio?.intro ?? '';
  const workExperiences = profile.portfolio?.workExperiences ?? [];
  const sortedActivities = [...(profile.portfolio?.activities ?? [])].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    if (yb !== ya) return yb - ya;
    return (b.month ?? '').localeCompare(a.month ?? '');
  });

  const items = profile.portfolio?.items ?? [];
  const projects = items.filter((it) => it.type === 'PROJECT');
  const research = items.filter((it) => it.type === 'RESEARCH');
  const studies = items.filter((it) => it.type === 'STUDY');

  // 프로필 소유자가 선택한 섹션만 표시. 미설정이면 전체 표시.
  const savedSections = profile.portfolio?.profileSections ?? [];
  const visibleSections: SectionKey[] =
    savedSections.length > 0
      ? SECTION_ORDER.filter((k) => savedSections.includes(k))
      : SECTION_ORDER;

  const currentTab = activeTab && visibleSections.includes(activeTab)
    ? activeTab
    : (visibleSections[0] ?? 'intro');

  const bannerClass = getBannerGradientClass(profile.bannerColor);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 배너 — 작성자가 본인 페이지에서 선택한 색상 그대로 노출 (read-only) */}
      <div
        className={`mb-6 h-32 w-full bg-gradient-to-br ${bannerClass}`}
        aria-hidden
      />

      {/* 프로필 요약 */}
      <div className="mb-6 flex items-start gap-6">
        <div className="flex h-31 w-31 items-center justify-center bg-primary-100 text-primary-600">
          <UserIcon className="h-14 w-14" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.lastName + profile.firstName}</h1>
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
                <span className="inline-flex items-center justify-center bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                  {mainRole}
                </span>
              )}
              {subRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center justify-center border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
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
                  className="bg-blue-50 px-2 py-1 text-xs text-blue-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* 채팅하기: context 없는 일반 대화 (RoomList 색 점 없음).
            스카우트: 팀 선택 → SCOUT_FROM_TEAM 컨텍스트 방. */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleStartChat}
            disabled={chatStarting}
            className="btn-secondary text-sm disabled:opacity-60"
          >
            {chatStarting ? '여는 중...' : '채팅하기'}
          </button>
          <button
            type="button"
            onClick={() => setScoutOpen(true)}
            className="btn-primary text-sm"
          >
            스카우트
          </button>
        </div>
      </div>
      <ScoutModal
        targetUser={
          scoutOpen && profile ? { id: profile.id, lastName: profile.lastName, firstName: profile.firstName } : null
        }
        onClose={() => setScoutOpen(false)}
      />

      {/* 한 줄 소개 */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">한 줄 소개</h2>
        {profile.bio ? (
          <p className="font-medium whitespace-pre-wrap break-words">{profile.bio}</p>
        ) : (
          <p className="text-sm text-gray-500">아직 등록된 한 줄 소개가 없습니다.</p>
        )}
      </div>

      {/* 외부 링크 */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">링크</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-500">아직 등록된 링크가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              const key = detectPlatform(link.url);
              const meta = PLATFORM_META[key];
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm shadow-sm transition-all hover:shadow-md ${meta.bg} ${meta.text}`}
                >
                  <PlatformIcon k={key} className="h-4 w-4" />
                  <span className="font-medium">{getDisplayLabel(link, key)}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* 포트폴리오 */}
      <section className="mb-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2>
          <p className="mt-1 text-sm text-gray-500">
            {profile.lastName + profile.firstName}님이 등록한 포트폴리오 항목입니다.
          </p>
        </div>

        <div className="space-y-4">
          {/* 세그먼트 컨트롤 */}
          <div
            role="tablist"
            aria-label="포트폴리오 섹션"
            className="inline-flex flex-wrap gap-1 bg-gray-100 p-1"
          >
            {visibleSections.map((k) => {
              const isActive = currentTab === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(k)}
                  className={`px-4 py-1.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {SECTION_LABEL[k]}
                </button>
              );
            })}
          </div>

          {/* 활성 탭 컨텐츠 */}
          {currentTab === 'intro' && (
            <div className="card">
              {intro.trim() ? (
                <p className="font-medium whitespace-pre-wrap break-words">{intro}</p>
              ) : (
                <p className="text-sm text-gray-400">아직 등록된 자기소개가 없습니다.</p>
              )}
            </div>
          )}

          {currentTab === 'experiences' && (
            <div className="card">
              {workExperiences.length === 0 ? (
                <p className="text-sm text-gray-400">등록된 실무 경험이 없습니다.</p>
              ) : (
                <ol className="space-y-3">
                  {workExperiences.map((exp, i) => (
                    <li key={exp.id} className="flex items-start gap-3 border border-gray-100 p-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-blue-50 text-xs font-semibold text-blue-600">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-800">
                            {exp.company} {exp.team}
                          </p>
                          {exp.current && (
                            <span className="inline-flex items-center gap-1 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              <span className="h-1.5 w-1.5 bg-green-500" />
                              재직중
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-600">{exp.role}</p>
                        <p className="mt-1 text-xs text-gray-400">{exp.period}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {currentTab === 'careers' && (
            <div className="card">
              {sortedActivities.length === 0 ? (
                <p className="text-sm text-gray-400">등록된 경력이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {sortedActivities.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-blue-500" aria-hidden />
                      <p className="flex-1 text-sm leading-relaxed text-gray-700">
                        <span className="font-semibold text-gray-900">{c.year}년</span>{' '}
                        {c.content}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {currentTab === 'projects' && (
            <SectionCardList
              userId={profile.id}
              items={projects}
              emptyText="등록된 프로젝트가 없습니다."
            />
          )}

          {currentTab === 'research' && (
            <SectionCardList
              userId={profile.id}
              items={research}
              emptyText="등록된 연구가 없습니다."
            />
          )}

          {currentTab === 'studies' && (
            <SectionCardList
              userId={profile.id}
              items={studies}
              emptyText="등록된 스터디가 없습니다."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function SectionCardList({
  userId,
  items,
  emptyText,
}: {
  userId: string;
  items: PortfolioItem[];
  emptyText: string;
}) {
  return (
    <div className="card">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const meta = TYPE_META[item.type];
            return (
              <Link
                key={item.id}
                href={`/portfolio/${userId}/items/${item.id}`}
                className="block border border-gray-100 p-3 transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                  {item.domain && (
                    <span className="bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
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
                        className="bg-gray-100 px-2 py-0.5 text-3xs text-gray-600"
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
