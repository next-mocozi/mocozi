'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { findMockFeedUser, type FeedUser } from '@/lib/mock/portfolioFeed';
import { notifyPortfolioChanged } from '@/hooks/useMyPortfolioStatus';
import api from '@/lib/api';
import { updateMyMeta, getPortfolioByUserId } from '@/lib/portfolio-api';
import {
  syncWorkExperienceToBackend,
  deleteWorkExperienceFromBackend,
  syncActivityToBackend,
  deleteActivityFromBackend,
  deleteItemFromBackend,
  hydratePortfolioFromBackend,
} from '@/lib/portfolio-mapper';
import PortfolioSegmentedNav from '@/components/portfolio/PortfolioSegmentedNav';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type ProfileLink,
} from '../_platforms';
import {
  CAREERS_STORAGE_KEY,
  CAREER_CONTENT_MAX,
  DEFAULT_CAREERS,
  DEFAULT_EXPS,
  DEFAULT_INTRO,
  DEFAULT_ITEMS,
  DEFAULT_LINKS,
  DownSelect,
  EMPTY_CAREER_FORM,
  EMPTY_EXP_FORM,
  EXPS_STORAGE_KEY,
  FeaturedStar,
  INTRO_MAX,
  INTRO_STORAGE_KEY,
  ITEMS_STORAGE_KEY,
  ItemMgrModal,
  LINKS_STORAGE_KEY,
  MAX_FEATURED,
  MAX_FEATURED_RESEARCH,
  MAX_FEATURED_STUDY,
  MONTH_OPTIONS,
  OWNER_STORAGE_KEY,
  ROLES_STORAGE_KEY,
  TYPE_META,
  VISIBILITY_STORAGE_KEY,
  YEAR_OPTIONS,
  YearMonthPicker,
  formatPeriod,
  parsePeriod,
  sortPortfolioItems,
  type CareerItem,
  type ExpFormState,
  type Experience,
  type PortfolioItem,
  type PortfolioItemType,
  type PortfolioVisibility,
} from '../_lib';

/** 사용자 단위 포트폴리오 상세 페이지.
 *  - URL: /portfolio/[userId]
 *  - 본인(params.userId === user.id): 기존 본인 페이지 UI 그대로 + 편집 가능
 *    · unwritten 상태(자기소개 비어있음 OR 기술스택 0개)면 /portfolio/onboarding 으로 게이팅
 *  - 타인: mock 피드 데이터로 읽기 전용 렌더, 비공개/미존재면 안내 화면
 *  - 비로그인: /login 으로 리다이렉트
 */
export default function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: paramUserId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const isOwner = !!user && user.id === paramUserId;
  const feedUser: FeedUser | undefined = useMemo(
    () => (!isOwner ? findMockFeedUser(paramUserId) : undefined),
    [isOwner, paramUserId],
  );

  // viewer 일 때 feedUser 데이터를 page.tsx 의 기존 state 모양으로 변환.
  // owner 면 null — 아래 useState 들은 DEFAULT_* fallback 으로 시작 후 useEffect 에서 localStorage 로드.
  const viewerInitial = useMemo(() => {
    if (!feedUser) return null;
    return {
      items: feedUser.portfolio.items,
      experiences: feedUser.portfolio.workExperiences.map((e, i) => ({
        id: i + 1,
        company: e.company,
        team: e.team ?? '',
        role: e.role,
        period: e.period,
        current: e.current,
      })) as Experience[],
      careers: feedUser.portfolio.externalActivities.map((c, i) => ({
        id: i + 1,
        year: c.year,
        content: c.content,
      })) as CareerItem[],
      intro: feedUser.portfolio.introduction,
      visibility: 'public' as PortfolioVisibility,
      mainRole: feedUser.mainRole ?? '',
      subRoles: feedUser.subRoles ?? [],
      links: feedUser.portfolio.links.map((l, i) => ({
        id: i + 1,
        url: l.url,
        label: l.label,
      })) as ProfileLink[],
    };
  }, [feedUser]);

  const [links, setLinks] = useState<ProfileLink[]>(
    viewerInitial?.links ?? DEFAULT_LINKS,
  );

  // 인증 + 본인 onboarding 게이트
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (isOwner) {
      // 서버에 저장된 skills 가 비어있을 때만 onboarding 으로 보낸다.
      // (이전엔 localStorage 의 intro 가 비어있기만 해도 리다이렉트했지만,
      //  시크릿 모드/캐시 정리 등으로 localStorage 가 사라진 경우에도 본인
      //  포트폴리오 페이지에서 항목 상세→돌아가기 흐름이 onboarding 으로
      //  튕기며 무한 로딩처럼 보이는 문제가 있었다. skills 는 서버 저장이라 신뢰 가능.)
      const skillsCount = user.skills?.length ?? 0;
      if (skillsCount < 1) {
        router.replace('/portfolio/onboarding');
      }
    }
  }, [loading, user, router, isOwner]);
  const [items, setItems] = useState<PortfolioItem[]>(
    viewerInitial?.items ?? DEFAULT_ITEMS,
  );
  const [experiences, setExperiences] = useState<Experience[]>(
    viewerInitial?.experiences ?? DEFAULT_EXPS,
  );
  const [careers, setCareers] = useState<CareerItem[]>(
    viewerInitial?.careers ?? DEFAULT_CAREERS,
  );

  // 직군 (owner 는 profile/edit 의 localStorage 에서, viewer 는 feedUser 에서)
  const [mainRole, setMainRole] = useState(viewerInitial?.mainRole ?? '');
  const [subRoles, setSubRoles] = useState<string[]>(
    viewerInitial?.subRoles ?? [],
  );

  // 자기소개 — owner 만 draft 편집. viewer 는 feedUser 의 introduction 을 그대로 표시.
  const [introSaved, setIntroSaved] = useState(
    viewerInitial?.intro ?? DEFAULT_INTRO,
  );
  const [introDraft, setIntroDraft] = useState(
    viewerInitial?.intro ?? DEFAULT_INTRO,
  );
  const [introJustSaved, setIntroJustSaved] = useState(false);
  const introRef = useRef<HTMLTextAreaElement>(null);

  // 자기소개 textarea — 내용에 따라 세로로 자동 확장
  useEffect(() => {
    const el = introRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [introDraft]);

  // 실무 경험 모달 (폼 + 리스트 통합)
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expEditId, setExpEditId] = useState<number | null>(null);
  const [expForm, setExpForm] = useState<ExpFormState>(EMPTY_EXP_FORM);
  const [expError, setExpError] = useState('');

  // 경력 모달 (폼 + 리스트 통합)
  const [careerModalOpen, setCareerModalOpen] = useState(false);
  const [careerEditId, setCareerEditId] = useState<number | null>(null);
  const [careerForm, setCareerForm] =
    useState<Omit<CareerItem, 'id'>>(EMPTY_CAREER_FORM);
  const [careerError, setCareerError] = useState('');

  // 포트폴리오 / 연구 / 스터디 관리 모달
  const [portfolioMgrOpen, setPortfolioMgrOpen] = useState(false);
  const [researchMgrOpen, setResearchMgrOpen] = useState(false);
  const [studyMgrOpen, setStudyMgrOpen] = useState(false);

  // 포트폴리오 공개/비공개 설정 — viewer 는 feedUser.isPublic (= 'public') 고정
  const [visibility, setVisibility] = useState<PortfolioVisibility>(
    viewerInitial?.visibility ?? 'private',
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 타인 portfolio 조회 결과. backend 호출 결과에 따라 비공개/없음을 정확히
  // 분기하기 위해 별도 state 로 관리. (mock 시대엔 findMockFeedUser 결과로
  // 분기했지만 mock 제거 후 항상 undefined 가 되어 누구를 보든 "비공개" 안내가
  // 잘못 떴다.)
  const [viewerStatus, setViewerStatus] = useState<
    'pending' | 'visible' | 'hidden' | 'notfound'
  >('pending');
  // 타인 viewer 일 때 보여줄 사용자 정보 (이름·학교·학과·bio·skills·roles).
  // 본인 페이지에서는 useAuth().user 를 그대로 쓰지만, 타인 페이지에서는
  // backend GET /api/users/:id 결과를 여기에 저장해서 화면에 노출.
  // (mock 시대엔 displayUser 가 feedUser ?? user 로 fallback 됐는데 mock 제거 후
  // 항상 본인 user 로 fallback 되어, 다른 사람 페이지 가도 본인 정보가 뜨던
  // 핵심 버그를 fix.)
  const [viewerUser, setViewerUser] = useState<{
    name: string;
    university: string;
    department: string;
    grade: string | null;
    bio: string | null;
    skills: string[];
    roles: string[];
  } | null>(null);

  // owner 만 backend hydrate → localStorage 읽기 → state set. viewer 는 viewerInitial 유지.
  // hydrate 를 먼저 await 해서 backend 의 isPublic/firstPostAt 등이 localStorage 에
  // 머지된 뒤 읽도록 한다. (이전엔 localStorage 만 읽어서 새 환경/시크릿 창에서
  // visibility 가 'private' 으로 잘못 보이는 문제 발생.)
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      try {
        await hydratePortfolioFromBackend();
      } catch {
        // 무시 — localStorage 만으로도 동작 유지
      }
      if (cancelled) return;
      hydrateFromLocalStorage();
      notifyPortfolioChanged();
    })();
    function hydrateFromLocalStorage() {
    const load = <T,>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    setLinks(load(LINKS_STORAGE_KEY, DEFAULT_LINKS));
    setItems(load(ITEMS_STORAGE_KEY, DEFAULT_ITEMS));
    setExperiences(load(EXPS_STORAGE_KEY, DEFAULT_EXPS));
    setCareers(load(CAREERS_STORAGE_KEY, DEFAULT_CAREERS));
    // 직군 — backend(user.roles[]) 우선, localStorage 는 캐시 fallback.
    // 다른 기기에서 변경한 직군이 즉시 반영되도록.
    const userRoles = user?.roles ?? [];
    if (userRoles.length > 0) {
      setMainRole(userRoles[0] ?? '');
      setSubRoles(userRoles.slice(1));
    } else {
      const cachedRoles = load<{ mainRole: string; subRoles: string[] } | null>(
        ROLES_STORAGE_KEY,
        null,
      );
      if (cachedRoles) {
        setMainRole(cachedRoles.mainRole);
        setSubRoles(cachedRoles.subRoles);
      }
    }
    try {
      const i = localStorage.getItem(INTRO_STORAGE_KEY);
      // localStorage 가 reconcileMockOwner 등으로 정리됐을 때를 대비해 user.bio 폴백.
      // (다른 계정으로 로그인했다 돌아오면 mock_* 가 정리되어 자기소개가 비어보이는 문제 방지)
      const fallback = user?.bio ?? '';
      const value = i && i.trim().length > 0 ? i : fallback;
      if (value) {
        setIntroSaved(value);
        setIntroDraft(value);
        // localStorage 가 비어있고 backend bio가 있으면 채워두기 (다음 진입 시 hot path)
        if ((i === null || i.trim().length === 0) && fallback) {
          localStorage.setItem(INTRO_STORAGE_KEY, fallback);
        }
      }
    } catch {
      // 기본값 유지
    }
    // VISIBILITY_STORAGE_KEY 는 raw string ('public' | 'private') 으로 저장됨.
    // load() 헬퍼는 JSON.parse 를 사용하므로 raw 문자열에 대해 throw → 항상 fallback.
    // 이로 인해 실제 'public' 인 사용자도 설정 다이얼로그/배지에서는 '비공개' 로
    // 보이고, 한편 useMyPortfolioStatus 는 raw 로 직접 읽어 'public' 으로 인식,
    // 피드에 본인 카드가 노출되는 불일치가 발생했었다.
    try {
      const rawV = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      setVisibility(rawV === 'public' ? 'public' : 'private');
    } catch {
      setVisibility('private');
    }
    }
    return () => {
      cancelled = true;
    };
    // user.bio / user.roles 가 늦게 도착(refreshUser 직후 등)하면 다시 머지하기 위해
    // user 도 deps 에 포함.
  }, [isOwner, user]);

  // 타인 프로필일 때 백엔드에서 직접 데이터 조회. mock 은 fallback 으로만 유지.
  // 백엔드 호출이 성공하면 viewerInitial(mock) 위에 실제 데이터를 덮어쓴다.
  // 실패하면(미구현 백엔드/네트워크 오류 등) 기존 viewerInitial 그대로 보여줌.
  useEffect(() => {
    if (isOwner || !user || loading) return;
    let cancelled = false;
    setViewerStatus('pending');
    (async () => {
      try {
        const remote = await getPortfolioByUserId(paramUserId);
        if (cancelled) return;
        if (!remote) {
          setViewerStatus('notfound');
          return;
        }
        if (!remote.isPublic) {
          // 비공개 portfolio + 타인 viewer — 본문 가려야 함.
          // backend 가 메타+user 만 반환하지만, 화면에선 "비공개" 안내만.
          setViewerStatus('hidden');
          return;
        }
        setViewerStatus('visible');
        // items: backend 형식 → 프론트 형식
        const remoteItems: PortfolioItem[] = (remote.items ?? []).map((b) => ({
          id: new Date(b.createdAt).getTime() || Date.now(),
          type: (b.type.toLowerCase() as PortfolioItemType) ?? 'project',
          title: b.title,
          description: b.description,
          summary: b.summary ?? undefined,
          period: b.period ?? b.duration ?? '',
          current: b.current ?? false,
          domain: b.domain || undefined,
          tags: b.tags ?? [],
          featured: b.featured ?? false,
          thumbnail: b.thumbnail ?? undefined,
          createdAt: new Date(b.createdAt).getTime(),
        }));
        setItems(remoteItems);
        setExperiences(
          (remote.workExperiences ?? []).map((w, i) => ({
            id: i + 1,
            company: w.company,
            team: w.team ?? '',
            role: w.role,
            period: w.period,
            current: w.current,
          })),
        );
        setCareers(
          (remote.activities ?? []).map((c, i) => ({
            id: i + 1,
            year: c.year,
            month: c.month ?? undefined,
            content: c.content,
          })),
        );
        setLinks(
          (remote.links ?? []).map((l, i) => ({
            id: i + 1,
            url: l.url,
            label: l.label ?? undefined,
          })),
        );
        setVisibility(remote.isPublic ? 'public' : 'private');

        // 사용자 메타(이름·학교·자기소개·skills·직군)는 user 엔드포인트에서.
        try {
          const userRes = await api.get(`/api/users/${paramUserId}`);
          if (cancelled) return;
          const u = (userRes.data?.data ?? userRes.data) as {
            name?: string;
            university?: string;
            department?: string;
            grade?: string | null;
            bio?: string | null;
            skills?: string[];
            roles?: string[];
          } | null;
          if (u) {
            setViewerUser({
              name: u.name ?? '',
              university: u.university ?? '',
              department: u.department ?? '',
              grade: u.grade ?? null,
              bio: u.bio ?? null,
              skills: u.skills ?? [],
              roles: u.roles ?? [],
            });
            if (u.bio) {
              setIntroSaved(u.bio);
              setIntroDraft(u.bio);
            }
            // 직군 (mainRole/subRoles) 도 그 사람 값으로 표시
            const roles = u.roles ?? [];
            setMainRole(roles[0] ?? '');
            setSubRoles(roles.slice(1));
          }
        } catch {
          // user 메타 실패는 무시 — portfolio 본문만 보여줘도 충분.
        }
      } catch {
        // 백엔드 호출 실패 — 사용자/포트폴리오를 못 가져옴 → 안내 화면.
        if (!cancelled) setViewerStatus('notfound');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, user, loading, paramUserId]);

  // 본인일 때 OWNER_STORAGE_KEY 를 현재 user.id 로 항상 동기화.
  // (이전에는 빈 값일 때만 기록했지만, 다른 계정으로 재로그인 시 stale 한 ID 가
  //  남아 edit 페이지 권한 거절·getMyPortfolioPath() 가 잘못된 사용자로 라우팅되는
  //  문제가 있었음 — 항상 덮어써서 일관성 유지.)
  useEffect(() => {
    if (!user || !isOwner) return;
    try {
      const existing = localStorage.getItem(OWNER_STORAGE_KEY);
      if (existing !== user.id) localStorage.setItem(OWNER_STORAGE_KEY, user.id);
    } catch {
      // 저장 실패 무시
    }
  }, [user, isOwner]);

  // 로그인 가드 — 모든 훅 호출 이후에 위치
  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  if (!user) return null;

  // 타인 viewer 의 안내 화면 — backend 호출 결과 기반.
  // pending → 로딩 (잠깐), hidden → 비공개, notfound → 사용자/포트폴리오 없음.
  if (!isOwner) {
    if (viewerStatus === 'pending') {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-gray-400">로딩 중…</p>
        </div>
      );
    }
    if (viewerStatus === 'hidden' || viewerStatus === 'notfound') {
      const isHidden = viewerStatus === 'hidden';
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Link
            href="/portfolio"
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 포트폴리오 피드로
          </Link>
          <div className="card text-center">
            <div className="mb-2 text-4xl">🔒</div>
            <p className="font-semibold text-gray-700">
              {isHidden
                ? '비공개 처리된 포트폴리오입니다.'
                : '사용자를 찾을 수 없습니다.'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {isHidden
                ? '소유자가 공개로 전환하면 열람할 수 있어요.'
                : '잘못된 링크이거나 삭제된 사용자일 수 있어요.'}
            </p>
          </div>
        </div>
      );
    }
  }

  const persist = (key: string, value: unknown) => {
    try {
      localStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    } catch {
      // 저장 실패 시 무시
    }
  };

  // ───────── 공개/비공개 설정 (owner 전용) ─────────
  const updateVisibility = (v: PortfolioVisibility) => {
    setVisibility(v);
    persist(VISIBILITY_STORAGE_KEY, v);
    notifyPortfolioChanged();
    setSettingsOpen(false);
    // 백엔드 동기화. 실패해도 localStorage 는 갱신했으므로 화면 동작은 유지되지만,
    // 다른 기기/세션에선 반영 안 됨 → 사용자에게 알림.
    void updateMyMeta({ isPublic: v === 'public' }).catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[portfolio] visibility 백엔드 동기화 실패:', err);
      }
      alert(
        '공개 설정이 서버에 저장되지 못했어요. 잠시 후 다시 시도해주세요.\n' +
          '(이 기기 화면에는 즉시 반영됩니다)',
      );
    });
  };

  // ───────── 자기소개 ─────────
  const introDirty = introDraft !== introSaved;

  const handleIntroChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value.slice(0, INTRO_MAX);
    setIntroDraft(v);
    if (introJustSaved) setIntroJustSaved(false);
  };

  const saveIntro = () => {
    if (!introDirty) return;
    setIntroSaved(introDraft);
    persist(INTRO_STORAGE_KEY, introDraft);
    void updateMyMeta({ intro: introDraft }).catch(() => {});
    notifyPortfolioChanged();
    setIntroJustSaved(true);
    setTimeout(() => setIntroJustSaved(false), 2000);
  };

  const resetIntro = () => setIntroDraft(introSaved);

  // ───────── 실무 경험 ─────────
  const openExpModal = () => {
    setExpEditId(null);
    setExpForm(EMPTY_EXP_FORM);
    setExpError('');
    setExpModalOpen(true);
  };

  const loadExpToForm = (exp: Experience) => {
    setExpEditId(exp.id);
    const parsed = parsePeriod(exp.period);
    setExpForm({
      company: exp.company,
      team: exp.team,
      role: exp.role,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      current: exp.current || parsed.current,
    });
    setExpError('');
  };

  const resetExpForm = () => {
    setExpEditId(null);
    setExpForm(EMPTY_EXP_FORM);
    setExpError('');
  };

  const saveExp = () => {
    if (!expForm.company.trim()) {
      setExpError('회사명을 입력해주세요.');
      return;
    }
    if (!expForm.startDate) {
      setExpError('시작 월을 선택해주세요.');
      return;
    }
    if (!expForm.current && !expForm.endDate) {
      setExpError('종료 월을 선택하거나 "재직중"을 체크해주세요.');
      return;
    }
    if (
      !expForm.current &&
      expForm.endDate &&
      expForm.endDate < expForm.startDate
    ) {
      setExpError('종료 월은 시작 월 이후여야 합니다.');
      return;
    }
    const period = formatPeriod(
      expForm.startDate,
      expForm.endDate,
      expForm.current,
    );
    const payload: Omit<Experience, 'id'> = {
      company: expForm.company,
      team: expForm.team,
      role: expForm.role,
      period,
      current: expForm.current,
    };
    const newId = expEditId ?? Date.now();
    const saved: Experience = { id: newId, ...payload };
    const next: Experience[] =
      expEditId === null
        ? [...experiences, saved]
        : experiences.map((e) => (e.id === expEditId ? saved : e));
    setExperiences(next);
    persist(EXPS_STORAGE_KEY, next);
    // 백엔드 동기화 — 실패해도 localStorage 기반 동작 유지
    void syncWorkExperienceToBackend(saved);
    resetExpForm(); // 모달은 열린 상태 유지 → 리스트에서 결과 확인
  };

  const deleteExp = (id: number) => {
    if (!confirm('이 항목을 삭제하시겠어요?')) return;
    const next = experiences.filter((e) => e.id !== id);
    setExperiences(next);
    persist(EXPS_STORAGE_KEY, next);
    void deleteWorkExperienceFromBackend(id);
    if (expEditId === id) resetExpForm();
  };

  // ───────── 경력 ─────────
  const openCareerModal = () => {
    setCareerEditId(null);
    setCareerForm(EMPTY_CAREER_FORM);
    setCareerError('');
    setCareerModalOpen(true);
  };

  const loadCareerToForm = (c: CareerItem) => {
    setCareerEditId(c.id);
    setCareerForm({ year: c.year, month: c.month ?? '', content: c.content });
    setCareerError('');
  };

  const resetCareerForm = () => {
    setCareerEditId(null);
    setCareerForm(EMPTY_CAREER_FORM);
    setCareerError('');
  };

  const saveCareer = () => {
    const year = careerForm.year.trim();
    const month = (careerForm.month ?? '').trim();
    const content = careerForm.content.trim();
    if (!year) {
      setCareerError('연도를 선택해주세요.');
      return;
    }
    if (!/^\d{4}$/.test(year)) {
      setCareerError('연도는 4자리 숫자여야 합니다. (예: 2024)');
      return;
    }
    if (!month) {
      setCareerError('월을 선택해주세요.');
      return;
    }
    if (!content) {
      setCareerError('내용을 입력해주세요.');
      return;
    }
    const newId = careerEditId ?? Date.now();
    const saved: CareerItem = { id: newId, year, month, content };
    const next: CareerItem[] =
      careerEditId === null
        ? [...careers, saved]
        : careers.map((c) => (c.id === careerEditId ? saved : c));
    setCareers(next);
    persist(CAREERS_STORAGE_KEY, next);
    void syncActivityToBackend(saved);
    resetCareerForm();
  };

  const deleteCareer = (id: number) => {
    if (!confirm('이 항목을 삭제하시겠어요?')) return;
    const next = careers.filter((c) => c.id !== id);
    setCareers(next);
    persist(CAREERS_STORAGE_KEY, next);
    void deleteActivityFromBackend(id);
    if (careerEditId === id) resetCareerForm();
  };

  // ───────── 포트폴리오/스터디 항목 (편집은 /portfolio/edit 페이지) ─────────
  const deleteItem = (id: number) => {
    if (!confirm('이 항목을 삭제하시겠어요?')) return;
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    persist(ITEMS_STORAGE_KEY, next);
    // 백엔드에서도 삭제 — 안 하면 hydrate 가 backend 에서 다시 가져와 부활.
    void deleteItemFromBackend(id);
  };

  // 연/월 내림차순 정렬 (최신이 위). month 없는 레거시 항목은 0 으로 취급.
  const sortedCareers = [...careers].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    if (yb !== ya) return yb - ya;
    const ma = Number(a.month ?? 0);
    const mb = Number(b.month ?? 0);
    if (mb !== ma) return mb - ma;
    return b.id - a.id;
  });

  // 임시저장(draft) 항목은 포트폴리오 탭에 노출하지 않음
  // (인터뷰 페이지의 "임시저장 목록" 버튼/팝업에서만 접근)
  const portfolioItems = sortPortfolioItems(
    items.filter(
      (it) => it.type !== 'study' && it.type !== 'research' && !it.draft,
    ),
  );
  const researchItems = sortPortfolioItems(
    items.filter((it) => it.type === 'research' && !it.draft),
  );
  const studyItems = sortPortfolioItems(
    items.filter((it) => it.type === 'study' && !it.draft),
  );
  const featuredCount = portfolioItems.filter((it) => it.featured).length;
  const featuredResearchCount = researchItems.filter((it) => it.featured).length;
  const featuredStudyCount = studyItems.filter((it) => it.featured).length;

  /** 대표 토글 — 항목 종류별 최대 개수 제한.
   *  project=4 / research=2 / study=2. 다른 type 은 토글 자체를 호출하지 않는다. */
  const toggleFeatured = (id: number) => {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const willBeFeatured = !target.featured;
    if (willBeFeatured) {
      const limit =
        target.type === 'research'
          ? MAX_FEATURED_RESEARCH
          : target.type === 'study'
            ? MAX_FEATURED_STUDY
            : MAX_FEATURED;
      const current =
        target.type === 'research'
          ? featuredResearchCount
          : target.type === 'study'
            ? featuredStudyCount
            : featuredCount;
      const label =
        target.type === 'research'
          ? '대표 연구'
          : target.type === 'study'
            ? '대표 스터디'
            : '대표 프로젝트';
      if (current >= limit) {
        alert(`${label}는 최대 ${limit}개까지만 지정할 수 있어요.`);
        return;
      }
    }
    const next = items.map((it) =>
      it.id === id ? { ...it, featured: willBeFeatured } : it,
    );
    setItems(next);
    persist(ITEMS_STORAGE_KEY, next);
  };

  // 헤더에 표시할 사용자 정보 — owner 면 useAuth().user, viewer 면 viewerUser.
  // (mock 시대엔 viewer 일 때도 useAuth().user 로 fallback 했는데 그게 누구의
  // 페이지든 본인 정보가 표시되는 버그였음. viewer 일 때는 viewer 정보만.)
  const displayUser = isOwner
    ? {
        name: user.name,
        university: user.university,
        department: user.department,
        grade: user.grade ?? '',
        bio: user.bio ?? '',
        skills: user.skills ?? [],
      }
    : viewerUser
      ? {
          name: viewerUser.name,
          university: viewerUser.university,
          department: viewerUser.department,
          grade: viewerUser.grade ?? '',
          bio: viewerUser.bio ?? '',
          skills: viewerUser.skills,
        }
      : {
          name: '',
          university: '',
          department: '',
          grade: '',
          bio: '',
          skills: [],
        };

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-8">
      {/* 본인 페이지일 때만 segmented nav — 피드/내 피드와 동일한 좌측 상단 위치 */}
      {isOwner && (
        <div className="relative z-0">
          <PortfolioSegmentedNav current="mine" isPublic={visibility === 'public'} />
        </div>
      )}
      {/* 본문 카드들은 기존 폭(max-w-4xl) 유지해 가독성 보존 */}
      <div className="mx-auto max-w-4xl">
      {/* ─────── 기본 정보 — /profile 페이지와 동일 (수정 버튼 없음) ─────── */}
      <div className="card relative mb-6">
        {/* 공개/비공개 상태 + 설정 버튼 — owner 전용 */}
        {isOwner && (
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                visibility === 'public'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  visibility === 'public' ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
              {visibility === 'public' ? '공개' : '비공개'}
            </span>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="포트폴리오 공개 설정"
              title="공개 설정"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-start gap-6 pr-32">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-3xl text-primary-600">
            👤
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{displayUser.name}</h1>
            </div>
            <p className="text-gray-600">
              {displayUser.university} {displayUser.department}
              {displayUser.grade && (
                <span className="ml-1 text-sm text-gray-400">
                  ·{' '}
                  {/^\d+$/.test(displayUser.grade)
                    ? `${displayUser.grade}학년`
                    : displayUser.grade}
                </span>
              )}
            </p>
            {displayUser.bio && (
              <p className="mt-2 text-sm text-gray-500">{displayUser.bio}</p>
            )}

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
            <div className="mt-2 flex flex-wrap gap-1">
              {(displayUser.skills ?? []).map((skill) => (
                <span
                  key={skill}
                  className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────── 링크 — /profile 페이지와 동일 ─────── */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">링크</h2>
        {links.length === 0 ? (
          isOwner ? (
            <p className="text-sm text-gray-500">
              아직 등록된 링크가 없습니다.{' '}
              <Link
                href="/profile/edit"
                className="text-blue-600 hover:underline"
              >
                프로필 수정
              </Link>
              에서 추가할 수 있어요.
            </p>
          ) : (
            <p className="text-sm text-gray-500">등록된 링크가 없습니다.</p>
          )
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
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-sm transition-all hover:shadow-md ${meta.bg} ${meta.text}`}
                >
                  <PlatformIcon k={key} className="h-4 w-4" />
                  <span className="font-medium">
                    {getDisplayLabel(link, key)}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 자기소개 — owner 는 편집, viewer 는 읽기 전용 ─────── */}
      <div className="card mb-6">
        <div className="px-1 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">자기소개</h2>
            {isOwner && (
              <span
                className={`text-xs ${
                  introDraft.length >= INTRO_MAX
                    ? 'text-red-500'
                    : introDraft.length >= INTRO_MAX * 0.9
                      ? 'text-amber-500'
                      : 'text-gray-400'
                }`}
              >
                {introDraft.length} / {INTRO_MAX}
              </span>
            )}
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={saveIntro}
              disabled={!introDirty}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              저장
            </button>
          )}
        </div>
        {isOwner ? (
          <>
            <textarea
              ref={introRef}
              value={introDraft}
              onChange={handleIntroChange}
              maxLength={INTRO_MAX}
              rows={2}
              placeholder="포트폴리오 상단에 노출될 자기소개를 작성해주세요. (최대 500자)"
              className="block w-full resize-none overflow-hidden rounded-lg border border-gray-200 px-4 py-3 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              {introJustSaved && !introDirty && (
                <span className="text-xs text-green-600">저장되었습니다.</span>
              )}
              {introDirty && (
                <span className="text-xs text-amber-500">
                  저장되지 않은 변경사항이 있어요.
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50/40 px-4 py-3 text-sm leading-relaxed text-gray-700">
            {introSaved || '등록된 자기소개가 없습니다.'}
          </p>
        )}
      </div>

      {/* ─────── 실무 경험(왼쪽) ↔ 경력(오른쪽) ─────── */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* 실무 경험 & 이력 — owner 만 편집 가능 */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">실무 경험 & 이력</h2>
            {isOwner && (
              <button
                type="button"
                onClick={openExpModal}
                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700"
              >
                + 추가
              </button>
            )}
          </div>
          {experiences.length === 0 ? (
            <p className="text-sm text-gray-500">
              아직 등록된 실무 경험이 없습니다.
            </p>
          ) : (
            <ol className="space-y-3">
              {experiences.map((exp, i) => (
                <li
                  key={exp.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 p-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-800">
                        {exp.company} {exp.team}
                      </p>
                      {exp.current && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
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

        {/* 경력 — owner 만 편집 가능 */}
        <div className="card">
          <div className=" mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">대외 경험</h2>
            {isOwner && (
              <button
                type="button"
                onClick={openCareerModal}
                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700"
              >
                + 추가
              </button>
            )}
          </div>
          {sortedCareers.length === 0 ? (
            <p className="text-sm text-gray-500">
              아직 등록된 경력이 없습니다. 수상·자격증·활동 등을 추가해보세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedCareers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                >
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                    aria-hidden
                  />
                  <p className="flex-1 text-sm leading-relaxed text-gray-700">
                    <span className="font-semibold text-gray-900">
                      {c.year}년{c.month ? ` ${Number(c.month)}월` : ''}
                    </span>{' '}
                    {c.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ─────── 포트폴리오 — owner 만 편집/대표 토글 가능 ─────── */}
      <div className="mb-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">프로젝트</h2>
            {isOwner && (
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                <span className="mr-0.5 text-amber-400">★</span>
                표시로 대표 프로젝트를 최대 {MAX_FEATURED}개까지 지정할 수
                있어요. 대표 프로젝트는 목록 맨 앞에 노출됩니다.{' '}
                <span className="font-medium text-gray-700">
                  ({featuredCount}/{MAX_FEATURED})
                </span>
              </p>
            )}
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setPortfolioMgrOpen(true)}
              className="btn-primary shrink-0 text-sm"
            >
              + 추가 / 관리
            </button>
          )}
        </div>

        {portfolioItems.length === 0 ? (
          isOwner ? (
            <button
              type="button"
              onClick={() => setPortfolioMgrOpen(true)}
              className="card flex w-full items-center justify-center border-dashed py-8 text-center text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
            >
              <div>
                <div className="mb-2 text-3xl">+</div>
                <p className="text-sm">새 프로젝트 항목 추가</p>
              </div>
            </button>
          ) : (
            <p className="card text-center text-sm text-gray-400">
              등록된 프로젝트가 없습니다.
            </p>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {portfolioItems.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/portfolio/${paramUserId}/items/${item.id}`}
                  className="card relative block transition-all hover:shadow-md"
                >
                  {/* 대표 프로젝트 즐겨찾기 (별) — owner 전용 */}
                  {isOwner && (
                    <FeaturedStar
                      featured={!!item.featured}
                      onToggle={() => toggleFeatured(item.id)}
                    />
                  )}
                  <div className="flex gap-3">
                    {/* 좌측: 카드 콘텐츠 */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
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
                        <span className="text-xs text-gray-500">{item.period}</span>
                        {item.current && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            진행중
                          </span>
                        )}
                      </div>
                      <h3 className="mb-2 font-semibold">{item.title}</h3>
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 우측: 썸네일 (없으면 백지) */}
                    <div
                      className={`shrink-0 overflow-hidden rounded-lg border ${
                        item.thumbnail ? 'border-gray-200' : 'border-dashed border-gray-200 bg-gray-50'
                      }`}
                      style={{ width: '5rem', height: '5rem' }}
                      aria-hidden
                    >
                      {item.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 연구 — owner 만 편집 가능 ─────── */}
      <div className="mb-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">연구</h2>
            {isOwner && (
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                <span className="mr-0.5 text-amber-400">★</span>
                표시로 대표 연구를 최대 {MAX_FEATURED_RESEARCH}개까지 지정할 수
                있어요.{' '}
                <span className="font-medium text-gray-700">
                  ({featuredResearchCount}/{MAX_FEATURED_RESEARCH})
                </span>
              </p>
            )}
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setResearchMgrOpen(true)}
              className="btn-primary shrink-0 text-sm"
            >
              + 추가 / 관리
            </button>
          )}
        </div>
        {researchItems.length === 0 ? (
          isOwner ? (
            <button
              type="button"
              onClick={() => setResearchMgrOpen(true)}
              className="card flex w-full items-center justify-center border-dashed py-8 text-center text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
            >
              <div>
                <div className="mb-2 text-3xl">+</div>
                <p className="text-sm">새 연구 항목 추가</p>
              </div>
            </button>
          ) : (
            <p className="card text-center text-sm text-gray-400">
              등록된 연구 항목이 없습니다.
            </p>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {researchItems.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/portfolio/${paramUserId}/items/${item.id}`}
                  className="card relative block transition-all hover:shadow-md"
                >
                  {isOwner && (
                    <FeaturedStar
                      featured={!!item.featured}
                      onToggle={() => toggleFeatured(item.id)}
                    />
                  )}
                  <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
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
                    <span className="text-xs text-gray-500">{item.period}</span>
                    {item.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        진행중
                      </span>
                    )}
                  </div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  {item.paperUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(
                          item.paperUrl,
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
                    >
                      📄 논문 →
                    </button>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 스터디 — owner 만 편집 가능 ─────── */}
      <div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">스터디</h2>
            {isOwner && (
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                <span className="mr-0.5 text-amber-400">★</span>
                표시로 대표 스터디를 최대 {MAX_FEATURED_STUDY}개까지 지정할 수
                있어요.{' '}
                <span className="font-medium text-gray-700">
                  ({featuredStudyCount}/{MAX_FEATURED_STUDY})
                </span>
              </p>
            )}
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setStudyMgrOpen(true)}
              className="btn-primary shrink-0 text-sm"
            >
              + 추가 / 관리
            </button>
          )}
        </div>

        {studyItems.length === 0 ? (
          isOwner ? (
            <button
              type="button"
              onClick={() => setStudyMgrOpen(true)}
              className="card flex w-full items-center justify-center border-dashed py-8 text-center text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
            >
              <div>
                <div className="mb-2 text-3xl">+</div>
                <p className="text-sm">새 스터디 항목 추가</p>
              </div>
            </button>
          ) : (
            <p className="card text-center text-sm text-gray-400">
              등록된 스터디 항목이 없습니다.
            </p>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {studyItems.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/portfolio/${paramUserId}/items/${item.id}`}
                  className="card relative block transition-all hover:shadow-md"
                >
                  {isOwner && (
                    <FeaturedStar
                      featured={!!item.featured}
                      onToggle={() => toggleFeatured(item.id)}
                    />
                  )}
                  <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
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
                    <span className="text-xs text-gray-500">{item.period}</span>
                    {item.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        진행중
                      </span>
                    )}
                  </div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
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

      {/* ─────── 모달 — owner 전용 ─────── */}
      {/* ─────── 실무 경험 모달 (폼 + 리스트) ─────── */}
      {isOwner && expModalOpen && (
        <div
          onClick={() => setExpModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <h2 className="text-lg font-bold px-1 py-2 text-gray-900">
                실무 경험 & 이력
              </h2>
              <button
                onClick={() => setExpModalOpen(false)}
                aria-label="닫기"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 pt-2">
              {/* 폼 섹션 */}
              <section className="mb-1 pt-1">
                <div className="mb-1 flex items-center justify-between py-1">
                  <h3 className="text-base font-bold text-gray-900">
                    {expEditId === null ? '새 항목 추가' : '항목 수정 중'}
                  </h3>
                  <div className="flex gap-3">
                    {expEditId !== null && (
                      <button
                        type="button"
                        onClick={resetExpForm}
                        className="rounded-full border border-gray-200 px-5 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        편집 취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveExp}
                      className="rounded-full bg-blue-600 px-5 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      {expEditId === null ? '추가' : '수정 저장'}
                    </button>
                  </div>
                </div>
                                
                  <div className="space-y-2 rounded-xl bg-gray-50/70 p-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        회사명
                      </label>
                      <input
                        type="text"
                        value={expForm.company}
                        onChange={(e) => {
                          setExpForm((f) => ({ ...f, company: e.target.value }));
                          if (expError) setExpError('');
                        }}
                        placeholder="예: OpenAI Korea"
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                          expError
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'
                        }`}
                      />
                      {expError && (
                        <p className="mt-1 text-xs text-red-500">{expError}</p>
                      )}
                    </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          팀 / 부서{' '}
                          <span className="text-xs font-normal text-gray-500">(선택)</span>
                        </label>
                        <input
                          type="text"
                          value={expForm.team}
                          onChange={(e) => setExpForm((f) => ({ ...f, team: e.target.value }))}
                          placeholder="예: 연구팀"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">역할</label>
                        <input
                          type="text"
                          value={expForm.role}
                          onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))}
                          placeholder="예: 리서치 인턴"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
</div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        기간
                      </label>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <YearMonthPicker
                          value={expForm.startDate}
                          onChange={(v) => {
                            setExpForm((f) => ({ ...f, startDate: v }));
                            if (expError) setExpError('');
                          }}
                        />
                        <span className="text-sm text-gray-400">~</span>
                        <YearMonthPicker
                          value={expForm.current ? '' : expForm.endDate}
                          onChange={(v) => {
                            setExpForm((f) => ({ ...f, endDate: v }));
                            if (expError) setExpError('');
                          }}
                          disabled={expForm.current}
                        />
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={expForm.current}
                            onChange={(e) =>
                              setExpForm((f) => ({
                                ...f,
                                current: e.target.checked,
                                endDate: e.target.checked ? '' : f.endDate,
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          재직중
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">


                </div>
              </section>

              {/* 리스트 섹션 */}
              <section className="border-t border-gray-200 pt-2">
                <h3 className="px-1 py-3 flex items-center gap-2 text-base font-bold text-gray-900">
                  <span className="h-4 w-1 rounded-full bg-gray-400" />
                  등록된 항목
                  <span className="text-xs font-normal text-gray-500">
                    ({experiences.length})
                  </span>
                </h3>
                {experiences.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    아직 등록된 항목이 없습니다.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {experiences.map((exp) => {
                      const editing = expEditId === exp.id;
                      return (
                        <li
                          key={exp.id}
                          className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${
                            editing
                              ? 'border-blue-300 bg-blue-50/40'
                              : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {exp.company} {exp.team}
                              </p>
                              {exp.current && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                  재직중
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-gray-600">
                              {exp.role}
                            </p>
                            <p className="mt-1.5 text-xs text-gray-500">
                              {exp.period}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => loadExpToForm(exp)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-blue-600"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExp(exp.id)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-red-500"
                            >
                              삭제
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            <div className="border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => setExpModalOpen(false)}
                className="w-full rounded-full bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────── 경력 모달 (폼 + 리스트) — owner 전용 ─────── */}
      {isOwner && careerModalOpen && (
        <div
          onClick={() => setCareerModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <h2 className="text-lg font-bold px-1 py-2 text-gray-900">
                대외 경험
              </h2>
              <button
                onClick={() => setCareerModalOpen(false)}
                aria-label="닫기"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4 pt-2">
              {/* 폼 섹션 */}
              <section className="mb-1 pt-1">
                <div className="mb-1 flex items-center justify-between py-1">
                  <h3 className="text-base font-bold text-gray-900">
                    {careerEditId === null ? '새 항목 추가' : '항목 수정 중'}
                  </h3>
                  <div className="flex gap-3">
                    {careerEditId !== null && (
                      <button
                        type="button"
                        onClick={resetCareerForm}
                        className="rounded-full border border-gray-200 px-5 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        편집 취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveCareer}
                      className="rounded-full bg-blue-600 px-5 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      {careerEditId === null ? '추가' : '수정 저장'}
                    </button>
                  </div>
                </div>
                <p className="mb-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  예시:{' '}
                  <span className="font-medium">
                    2024년 xxxx 해커톤 은상 수상
                  </span>
                  ,{' '}
                  <span className="font-medium">2023년 0000 부트캠프 참여</span>
                </p>

                <div className="space-y-2 rounded-xl bg-gray-50/70 p-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      연/월
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <DownSelect
                        value={careerForm.year}
                        onChange={(v) => {
                          setCareerForm((f) => ({ ...f, year: v }));
                          if (careerError) setCareerError('');
                        }}
                        options={YEAR_OPTIONS.map((y) => ({
                          value: String(y),
                          label: `${y}년`,
                        }))}
                        placeholder="연도"
                        ariaLabel="연도"
                      />
                      <DownSelect
                        value={careerForm.month ?? ''}
                        onChange={(v) => {
                          setCareerForm((f) => ({ ...f, month: v }));
                          if (careerError) setCareerError('');
                        }}
                        options={MONTH_OPTIONS.map((m) => ({
                          value: String(m).padStart(2, '0'),
                          label: `${m}월`,
                        }))}
                        placeholder="월"
                        ariaLabel="월"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">내용</label>
                      <p className="text-xs text-gray-500">
                        {careerForm.content.length} / {CAREER_CONTENT_MAX}
                      </p>
                    </div>
                    <input
                      type="text"
                      value={careerForm.content}
                      onChange={(e) => {
                        setCareerForm((f) => ({
                          ...f,
                          content: e.target.value.slice(0, CAREER_CONTENT_MAX),
                        }));
                        if (careerError) setCareerError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveCareer();
                      }}
                      placeholder="예: xxxx 해커톤 은상 수상"
                      maxLength={CAREER_CONTENT_MAX}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {careerError && (
                    <p className="text-xs text-red-500">{careerError}</p>
                  )}
                </div>
              </section>

              {/* 리스트 섹션 */}
              <section className="border-t border-gray-200 pt-2">
                <h3 className="px-1 py-3 flex items-center gap-2 text-base font-bold text-gray-900">
                  <span className="h-4 w-1 rounded-full bg-gray-400" />
                  등록된 항목
                  <span className="text-xs font-normal text-gray-500">
                    ({sortedCareers.length})
                  </span>
                </h3>
                {sortedCareers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    아직 등록된 항목이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {sortedCareers.map((c) => {
                      const editing = careerEditId === c.id;
                      return (
                        <li
                          key={c.id}
                          className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${
                            editing
                              ? 'border-blue-300 bg-blue-50/40'
                              : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                            aria-hidden
                          />
                          <p className="flex-1 text-sm leading-relaxed text-gray-700">
                            <span className="font-semibold text-gray-900">
                              {c.year}년{c.month ? ` ${Number(c.month)}월` : ''}
                            </span>{' '}
                            {c.content}
                          </p>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => loadCareerToForm(c)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-blue-600"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCareer(c.id)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-red-500"
                            >
                              삭제
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => setCareerModalOpen(false)}
                className="w-full rounded-full bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────── 프로젝트 관리 모달 — owner 전용 ─────── */}
      {isOwner && portfolioMgrOpen && (
        <ItemMgrModal
          title="프로젝트 관리"
          items={portfolioItems}
          addLabel="+ 새 프로젝트 항목 추가"
          addHref="/portfolio/edit"
          onClose={() => setPortfolioMgrOpen(false)}
          onDelete={deleteItem}
        />
      )}

      {/* ─────── 연구 관리 모달 — owner 전용 ─────── */}
      {isOwner && researchMgrOpen && (
        <ItemMgrModal
          title="연구 관리"
          items={researchItems}
          addLabel="+ 새 연구 항목 추가"
          addHref="/portfolio/edit?type=research"
          onClose={() => setResearchMgrOpen(false)}
          onDelete={deleteItem}
        />
      )}

      {/* ─────── 스터디 관리 모달 — owner 전용 ─────── */}
      {isOwner && studyMgrOpen && (
        <ItemMgrModal
          title="스터디 관리"
          items={studyItems}
          addLabel="+ 새 스터디 항목 추가"
          addHref="/portfolio/edit?type=study"
          onClose={() => setStudyMgrOpen(false)}
          onDelete={deleteItem}
        />
      )}

      {/* ─────── 포트폴리오 공개 설정 모달 — owner 전용 ─────── */}
      {isOwner && settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">
                포트폴리오 공개 설정
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="닫기"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              <button
                type="button"
                onClick={() => updateVisibility('public')}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  visibility === 'public'
                    ? 'border-blue-400 bg-blue-50/60'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">공개</p>
                  {visibility === 'public' && (
                    <span className="text-sm text-blue-600">✓ 선택됨</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  다른 사용자가 내 포트폴리오를 볼 수 있어요.
                </p>
              </button>
              <button
                type="button"
                onClick={() => updateVisibility('private')}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  visibility === 'private'
                    ? 'border-blue-400 bg-blue-50/60'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">비공개</p>
                  {visibility === 'private' && (
                    <span className="text-sm text-blue-600">✓ 선택됨</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  본인만 볼 수 있어요. 다른 사용자는 접근할 수 없습니다.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// FeaturedStar / ItemMgrModal 은 ../_lib 에서 import — 정의 중복 제거
