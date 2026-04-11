/** 기술 스택 목록 */
export const SKILLS = [
  // 프론트엔드
  'React',
  'Next.js',
  'Vue',
  'Nuxt.js',
  'Angular',
  'Svelte',
  'TypeScript',
  'JavaScript',
  'HTML/CSS',
  'Tailwind CSS',
  'Sass/SCSS',

  // 백엔드
  'Node.js',
  'Nest.js',
  'Express',
  'Spring',
  'Spring Boot',
  'Django',
  'Flask',
  'FastAPI',
  'Go',
  'Rust',

  // 모바일
  'React Native',
  'Flutter',
  'Swift',
  'Kotlin',
  'Android',
  'iOS',

  // 데이터베이스
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Firebase',
  'Supabase',

  // 인프라/DevOps
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'CI/CD',
  'Terraform',
  'Nginx',

  // AI/ML
  'Python',
  'TensorFlow',
  'PyTorch',
  'OpenAI API',
  'LangChain',

  // 데이터
  'Pandas',
  'Spark',
  'Airflow',
  'SQL',

  // 디자인
  'Figma',
  'Adobe XD',
  'Sketch',

  // 언어
  'Java',
  'C',
  'C++',
  'C#',
  'PHP',
  'Ruby',
] as const;

export type Skill = (typeof SKILLS)[number];
