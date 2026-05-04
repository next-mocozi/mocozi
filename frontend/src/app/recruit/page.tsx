'use client';
import { Fascinate_Inline } from 'next/font/google';
import {useState, useMemo, useEffect} from 'react';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';

// auth 연결 전 임시값 (로그인한 사용자의 학교)
const CURRENT_USER_SCHOOL = '고려대학교';
const PAGE_SIZE = 12;

const toggleItem = (item: string, list: string[], setList: (v: string[]) => void) => {
  if (list.includes(item)) {
    setList(list.filter((i) => i !== item));  // 이미 선택된 거면 제거
  } else {
    setList([...list, item]);  // 없으면 추가
  }
};
export default function RecruitListPage() {
  const MOCK_PROFILES = [
  {
    id: 1,
    name: '백승준',
    university: '고려대학교',
    department: '인공지능학과',
    schoolColor: '#8B0000',
    mainRole: 'AI/ML',
    subRoles: ['데이터'],
    skills: ['Python', 'TensorFlow', 'NLP', 'Computer Vision'],
    bio: '참고로 CV, NLP, 오픈소스 구현에 관심 있으며 개발자로 성장 중입니다.',
    image: null,
  },
  {
    id: 2,
    name: '김민준',
    university: '한양대학교',
    department: '컴퓨터공학과',
    schoolColor: '#003876',
    mainRole: '프론트엔드',
    subRoles: ['풀스택'],
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
    bio: '사용자 경험을 중요하게 생각하는 프론트엔드 개발자입니다.',
    image: null,
  },
  {
    id: 3,
    name: '이서연',
    university: '연세대학교',
    department: '소프트웨어학과',
    schoolColor: '#00205B',
    mainRole: '백엔드',
    subRoles: ['DevOps/인프라'],
    skills: ['Spring Boot', 'Java', 'MySQL', 'Docker'],
    bio: '안정적인 서버 설계를 좋아하는 백엔드 개발자입니다.',
    image: null,
  },
   {
    id: 4,
    name: '박지훈',
    university: '서울대학교',
    department: '전기정보공학부',
    schoolColor: '#000080',
    mainRole: '풀스택',
    subRoles: ['백엔드', '프론트엔드'],
    skills: ['Next.js', 'Spring Boot', 'PostgreSQL', 'Docker'],
    bio: '처음부터 끝까지 혼자서도 만들 수 있는 풀스택 개발자를 목표로 합니다.',
    image: null,
  },
  {
    id: 5,
    name: '최유진',
    university: '성균관대학교',
    department: '글로벌융합학부',
    schoolColor: '#004B23',
    mainRole: 'UI/UX 디자이너',
    subRoles: ['PM/PO'],
    skills: ['Figma', 'React', 'Tailwind CSS', 'Jira'],
    bio: '사용자 입장에서 생각하고 디자인과 개발을 연결하는 걸 좋아합니다.',
    image: null,
  },
  {
    id: 6,
    name: '정하늘',
    university: '고려대학교',
    department: '컴퓨터학과',
    schoolColor: '#8B0000',
    mainRole: '백엔드',
    subRoles: ['DevOps/인프라'],
    skills: ['Node.js', 'NestJS', 'PostgreSQL', 'AWS', 'Docker'],
    bio: '대규모 트래픽을 다루는 백엔드 시스템에 관심이 많습니다.',
    image: null,
  },
  {
    id: 7,
    name: '강수빈',
    university: 'KAIST',
    department: '전산학부',
    schoolColor: '#004A99',
    mainRole: '모바일',
    subRoles: ['프론트엔드'],
    skills: ['React Native', 'Flutter', 'TypeScript', 'iOS', 'Android'],
    bio: '크로스 플랫폼 모바일 앱 개발을 좋아합니다.',
    image: null,
  },
  {
    id: 8,
    name: '윤도현',
    university: '한양대학교',
    department: '데이터사이언스학부',
    schoolColor: '#003876',
    mainRole: '데이터',
    subRoles: ['AI/ML'],
    skills: ['Python', 'Pandas', 'PyTorch', 'TensorFlow', 'MySQL'],
    bio: '데이터로 인사이트를 만드는 일에 흥미를 느낍니다.',
    image: null,
  },
  {
    id: 9,
    name: '한지원',
    university: '포항공과대학교',
    department: '컴퓨터공학과',
    schoolColor: '#7B1A1A',
    mainRole: 'AI/ML',
    subRoles: ['데이터'],
    skills: ['Python', 'PyTorch', 'LangChain', 'OpenAI API'],
    bio: 'LLM 기반 서비스 개발에 관심이 있습니다.',
    image: null,
  },
  {
    id: 10,
    name: '오시현',
    university: '고려대학교',
    department: '미디어학부',
    schoolColor: '#8B0000',
    mainRole: 'UI/UX 디자이너',
    subRoles: ['프론트엔드'],
    skills: ['Figma', 'React', 'Tailwind CSS', 'TypeScript'],
    bio: '디자인 시스템과 컴포넌트 설계에 관심 많습니다.',
    image: null,
  },
  {
    id: 11,
    name: '임채원',
    university: '연세대학교',
    department: '컴퓨터과학과',
    schoolColor: '#00205B',
    mainRole: '풀스택',
    subRoles: ['프론트엔드', '백엔드'],
    skills: ['Next.js', 'NestJS', 'TypeScript', 'PostgreSQL', 'Docker'],
    bio: '개인 프로젝트 여러개 운영중인 풀스택 개발자입니다.',
    image: null,
  },
  {
    id: 12,
    name: '백승현',
    university: '서울대학교',
    department: '컴퓨터공학부',
    schoolColor: '#000080',
    mainRole: '게임',
    subRoles: ['프론트엔드'],
    skills: ['JavaScript', 'TypeScript', 'React'],
    bio: '인디 게임 개발에 관심 많은 개발자입니다.',
    image: null,
  },
  {
    id: 13,
    name: '김동균',
    university: '서강대학교',
    department: '컴퓨터공학과',
    schoolColor: '#b6001f',
    mainRole: '임베디드',
    subRoles: ['프론트엔드', '백엔드'],
    skills: ['JavaScript', 'TypeScript', 'Go', 'FastAPI'],
    bio: '반수한 김동균입니다.',
    image: null,
  },
  {
    id: 14,
    name: '김동균',
    university: '서강대학교',
    department: '컴퓨터공학과',
    schoolColor: '#b6001f',
    mainRole: '임베디드',
    subRoles: ['프론트엔드', '백엔드'],
    skills: ['JavaScript', 'TypeScript', 'Go', 'FastAPI'],
    bio: '반수한 김동균입니다.',
    image: null,
  },
  {
    id: 15,
    name: '김동균',
    university: '서강대학교',
    department: '컴퓨터공학과',
    schoolColor: '#b6001f',
    mainRole: '임베디드',
    subRoles: ['프론트엔드', '백엔드'],
    skills: ['JavaScript', 'TypeScript', 'Go', 'FastAPI'],
    bio: '반수한 김동균입니다.',
    image: null,
  },
  {
    id: 16,
    name: '김동균',
    university: '서강대학교',
    department: '컴퓨터공학과',
    schoolColor: '#b6001f',
    mainRole: '임베디드',
    subRoles: ['프론트엔드', '백엔드'],
    skills: ['JavaScript', 'TypeScript', 'Go', 'FastAPI'],
    bio: '반수한 김동균입니다.',
    image: null,
  },
];
  const[isOpen, setIsOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedSkills, setAppliedSkills] = useState<string[]>([]);
  const [appliedSameSchool, setAppliedSameSchool] = useState(false);
  const [keyword, setKeyword] = useState('');           // input 바인딩용
  const [appliedKeyword, setAppliedKeyword] = useState(''); // 실제 검색에 적용되는 키워드

  // 검색 버튼/Enter로 키워드 확정
  const applySearch = () => setAppliedKeyword(keyword.trim());

  // 적용된 필터 + 키워드로 프로필 필터링
  const filteredProfiles = useMemo(() => {
    return MOCK_PROFILES.filter((p) => {
      // 1) 키워드: 이름·학과·소개·직군·스킬 부분일치
      //    NOTE: 학교(p.university)는 의도적으로 제외 — 특정 학교명 검색을 막아
      //    학교 차별 위험을 방지함. 학교 기반 검색은 '같은 학교' 토글로만 가능.
      if (appliedKeyword) {
        const q = appliedKeyword.toLowerCase();
        const haystack = [
          p.name,
          p.department,
          p.bio,
          p.mainRole,
          ...p.subRoles,
          ...p.skills,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 2) 직군: 선택된 직군 중 하나라도 mainRole/subRoles에 포함되면 통과 ('전체'는 무시)
      const roleFilters = appliedRoles.filter((r) => r !== '전체');
      if (roleFilters.length > 0) {
        const profileRoles = [p.mainRole, ...p.subRoles];
        const hit = roleFilters.some((r) => profileRoles.includes(r));
        if (!hit) return false;
      }

      // 3) 스킬: 선택된 스킬 중 하나라도 보유하면 통과 (OR 조건)
      if (appliedSkills.length > 0) {
        const hit = appliedSkills.some((s) => p.skills.includes(s));
        if (!hit) return false;
      }

      // 4) 같은 학교: 현재 사용자 학교와 일치해야 통과
      if (appliedSameSchool && p.university !== CURRENT_USER_SCHOOL) return false;

      return true;
    });
  }, [appliedKeyword, appliedRoles, appliedSkills, appliedSameSchool]);

  const hasActiveFilters =
    appliedKeyword !== '' ||
    appliedRoles.length > 0 ||
    appliedSkills.length > 0 ||
    appliedSameSchool;

  const { currentPage, setPage, totalPages, startIndex, endIndex } =
    usePagination({ totalItems: filteredProfiles.length, pageSize: PAGE_SIZE });

  const pageItems = useMemo(
    () => filteredProfiles.slice(startIndex, endIndex),
    [filteredProfiles, startIndex, endIndex],
  );

  // 필터/검색이 바뀌면 1페이지로 리셋
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
  }, [appliedKeyword, appliedRoles, appliedSkills, appliedSameSchool]);


  return (
   <div className="flex gap-2 w-full items-center">
    <div className="w-full px-30 py-10">

      {/* 상단 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">팀원 찾기</h1>
      </div>

      {/* 필터: 같은 학교 토글 (검색창 위 한 줄 — 팀 페이지와 높이 통일) */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setAppliedSameSchool(!appliedSameSchool)}
          className={`inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
            appliedSameSchool
              ? 'border-blue-600 bg-blue-600 text-white shadow'
              : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'
          }`}
        >
          🏫 같은 학교
        </button>
      </div>

<div className="flex gap-2">

  {/* 검색창 - 키워드 input + 검색 버튼 */}
  <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 px-6 py-3 shadow-md">
    <input
      type="text"
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') applySearch();
      }}
      placeholder="키워드로 검색"
      className="flex-1 bg-transparent outline-none min-w-[120px]"
    />
    <button
      type="button"
      onClick={applySearch}
      aria-label="검색"
      className="text-blue-600 hover:text-blue-800 transition-all"
    >
      🔍
    </button>
  </div>

  {/* 상세 검색 버튼 - 열 때 모달 내부 선택 상태를 현재 적용 상태와 동기화 */}
  <button
    onClick={() => {
      setSelectedRoles(appliedRoles);
      setSelectedSkills(appliedSkills);
      setIsOpen(true);
    }}
    className="rounded-full border border-blue-200 bg-white px-6 py-3 text-blue-600 shadow-md transition-all hover:bg-blue-600 hover:text-white hover:shadow-lg"
  >
    ➕ 검색 필터
  </button>

</div>

{/* 적용된 필터 태그 라인 (검색창 아래, 한 줄) */}
{hasActiveFilters && (
  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
    {appliedKeyword && (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-700">키워드:</span>
        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-700">
          <button
            onClick={() => {
              setAppliedKeyword('');
              setKeyword('');
            }}
            className="text-gray-400 hover:text-gray-600"
            aria-label="키워드 제거"
          >
            ✕
          </button>
          {appliedKeyword}
        </span>
      </div>
    )}
    {appliedRoles.length > 0 && (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-700">직군:</span>
        {appliedRoles.map((role) => (
          <span
            key={role}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-600"
          >
            <button
              onClick={() =>
                setAppliedRoles(appliedRoles.filter((r) => r !== role))
              }
              className="text-blue-400 hover:text-blue-700"
              aria-label={`${role} 제거`}
            >
              ✕
            </button>
            {role}
          </span>
        ))}
      </div>
    )}
    {appliedSkills.length > 0 && (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-700">기술 스택:</span>
        {appliedSkills.map((skill) => (
          <span
            key={skill}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-600"
          >
            <button
              onClick={() =>
                setAppliedSkills(appliedSkills.filter((s) => s !== skill))
              }
              className="text-gray-400 hover:text-gray-700"
              aria-label={`${skill} 제거`}
            >
              ✕
            </button>
            {skill}
          </span>
        ))}
      </div>
    )}
    {appliedSameSchool && (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-700">학교:</span>
        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-600">
          <button
            onClick={() => setAppliedSameSchool(false)}
            className="text-blue-400 hover:text-blue-700"
            aria-label="같은 학교 필터 제거"
          >
            ✕
          </button>
          🏫 같은 학교
        </span>
      </div>
    )}
  </div>
)}

<div className="mt-4 text-sm text-gray-500">
  검색 결과 <span className="font-semibold text-blue-600">{filteredProfiles.length}</span>명
</div>
{filteredProfiles.length === 0 ? (
<div className="mt-6 flex h-[420px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-gray-100 bg-white text-center shadow-sm transition-all hover:shadow-md">
    <p className="text-2xl">🔍</p>
    <p className="text-base font-semibold">검색 결과가 없습니다</p>
    <p className="text-sm text-gray-400">키워드나 필터를 변경해 보세요.</p>
  </div>
) : (
<div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {pageItems.map((person) => (
    <div key={person.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">

      {/* 상단 학교 배경 */}
      <div
  className="flex h-28 flex-col items-center justify-center"
  style={{ backgroundColor: person.schoolColor }}
>
        <p className="font-bold text-white">{person.university}</p>
        <p className="text-xs text-white opacity-70">{person.department}</p>
      </div>

      {/* 프로필 사진 */}
      <div className="flex justify-center -mt-8">
<div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gray-200 text-2xl shadow">
          {person.image ? (
            <img src={person.image} className="rounded-full" />
          ) : (
            person.name[0]
          )}
        </div>
      </div>

      {/* 카드 내용 */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-2">

        {/* 이름 */}
        <p className="mb-2 text-center text-lg font-bold">{person.name}</p>

        {/* 메인 직군 + 세부 직군 */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-1">
          <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
            {person.mainRole}
          </span>
          {person.subRoles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center justify-center rounded-full border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
            >
              {role}
            </span>
          ))}
        </div>

        {/* 한줄 소개 */}
        <p className="mb-3 text-center text-sm text-gray-500 line-clamp-2">{person.bio}</p>

        {/* 스킬 태그 */}
        <div className="mb-4 flex flex-wrap justify-center gap-1">
          {person.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {skill}
            </span>
          ))}
          {person.skills.length > 3 && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              +{person.skills.length - 3}
            </span>
          )}
        </div>

        {/* 포트폴리오 버튼 - 카드 높이 다른 경우에도 항상 하단에 정렬됨 */}
        <button className="mt-auto rounded-full border border-blue-200 py-2 text-sm text-blue-600 transition-all hover:bg-blue-600 hover:text-white">
          프로필 보기
        </button>

      </div>
    </div>
  ))}
</div>
)}
{filteredProfiles.length > 0 && (
  <Pagination
    currentPage={currentPage}
    totalPages={totalPages}
    onPageChange={setPage}
    className="mt-8"
  />
)}
    </div>

    {isOpen&& (
      <div
      onClick={() => setIsOpen(false)}
      className ='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
    >
      <div>
        <div
  onClick={(e) => e.stopPropagation()}
  className="w-[500px] rounded-2xl bg-white p-6 shadow-xl"
>
  {/* 헤더 */}
  <div className="mb-6 flex items-center justify-between">
    <h2 className="text-lg font-bold">검색 필터</h2>
    <button
      onClick={() => setIsOpen(false)}
      className="text-gray-400 hover:text-gray-600"
    >
      ✕
    </button>
  </div>
{/*직군**/}
  <p className="mb-2 font-semibold">직군</p>
<div className="flex flex-wrap justify-center gap-2 border border-gray-100 rounded-xl p-3">  
{['전체',
  '프론트엔드',
  '백엔드',
  '풀스택',
  '모바일',
  'DevOps/인프라',
  'AI/ML',
  '데이터',
  '보안',
  'QA',
  '게임',
  '임베디드',
  'UI/UX 디자이너',
  'PM/PO',].map((role) => (
  <button
    key={role}
    onClick={() => toggleItem(role, selectedRoles, setSelectedRoles)}
    className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
      selectedRoles.includes(role)
        ? 'bg-blue-600 text-white border-blue-600'
        : 'border-blue-200 text-blue-600 hover:bg-blue-50'
    }`}
  >
    {role}
  </button>
))}
</div>
 {/* 기술 */}
<div className="mb-4">
  <br></br>
  <p className="mb-2 font-semibold">기술 스택</p>

  {/* 스킬 검색창 */}
  <input
    type="text"
    value={skillSearch}
    onChange={(e) => setSkillSearch(e.target.value)}
    placeholder="스킬 검색..."
    className="mb-3 w-full rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
  />

  {/* 필터링된 스킬 버튼들 */}
<div className="flex flex-col gap-3 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-3">
  {[
    { label: '프론트엔드', skills: ['React', 'Next.js', 'Vue.js', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Redux', 'Vite'] },
    { label: '백엔드', skills: ['Node.js', 'NestJS', 'Spring Boot', 'Java', 'Python', 'FastAPI', 'Go', 'Kotlin', 'PHP', 'Rust'] },
    { label: '모바일', skills: ['React Native', 'Flutter', 'Swift', 'iOS', 'Android'] },
    { label: '데이터베이스', skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase', 'GraphQL'] },
    { label: 'DevOps', skills: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Linux'] },
    { label: 'AI/데이터', skills: ['TensorFlow', 'PyTorch', 'Pandas', 'LangChain', 'OpenAI API'] },
    { label: '툴/기타', skills: ['Git', 'GitHub', 'Figma', 'Jest', 'Jira'] },
  ].map(({ label, skills }) => {
    const filtered = skills.filter((skill) =>
      skill.toLowerCase().includes(skillSearch.toLowerCase())
    );
    if (filtered.length === 0) return null;
    return (
      <div key={label}>
        <p className="mb-1 text-xs font-semibold text-gray-400">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((skill) => (
            <button
              key={skill}
              onClick={() => toggleItem(skill, selectedSkills, setSelectedSkills)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                selectedSkills.includes(skill)
                  ? 'bg-gray-700 text-white border-gray-700'
                  : 'border-gray-200 hover:bg-gray-100'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>
    );
  })}
</div>
</div>

  {/* 적용 버튼 */}
 <button
  onClick={() => {
    setAppliedRoles(selectedRoles);
    setAppliedSkills(selectedSkills);
    setIsOpen(false);
  }}
  className="mt-4 w-full rounded-full bg-blue-600 py-3 text-white shadow-md hover:bg-blue-700"
>
  검색 적용
</button>

</div>
      </div>
      </div>
      )}
    </div>
  );
}
