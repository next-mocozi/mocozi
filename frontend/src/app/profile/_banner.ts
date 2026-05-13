// 프로필 배너 색상 — 본인 페이지(/profile)와 타인 페이지(/profile/[id])가 공유.
// backend User.bannerColor 가 source of truth.

export type BannerColor =
  | 'indigo'
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'sky'
  | 'fuchsia'
  | 'stone'
  | 'slate';

export const BANNER_GRADIENTS: {
  key: BannerColor;
  label: string;
  class: string;
}[] = [
  { key: 'indigo',  label: '인디고',   class: 'from-indigo-600 via-indigo-700 to-violet-700' },
  { key: 'rose',    label: '로즈',     class: 'from-rose-500 via-rose-600 to-pink-700' },
  { key: 'emerald', label: '에메랄드', class: 'from-emerald-500 via-emerald-600 to-teal-700' },
  { key: 'amber',   label: '앰버',     class: 'from-amber-400 via-orange-500 to-rose-600' },
  { key: 'sky',     label: '스카이',   class: 'from-sky-400 via-sky-600 to-blue-700' },
  { key: 'fuchsia', label: '푸시아',   class: 'from-fuchsia-500 via-purple-600 to-violet-700' },
  { key: 'stone',   label: '스톤',     class: 'from-stone-400 via-stone-500 to-stone-600' },
  { key: 'slate',   label: '슬레이트', class: 'from-slate-700 via-slate-800 to-slate-900' },
];

export const DEFAULT_BANNER_COLOR: BannerColor = 'indigo';

/** key 가 잘못된 값이거나 null 이어도 안전하게 default 반환. */
export function getBannerGradientClass(key: string | null | undefined): string {
  const found = BANNER_GRADIENTS.find((g) => g.key === key);
  return found?.class ?? BANNER_GRADIENTS[0].class;
}
