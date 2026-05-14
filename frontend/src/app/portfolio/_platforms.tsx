// 프로필 외부 링크용 표시 유틸 — 순수 프론트 (백엔드 무관, 교체 대상 아님).
// 데이터/mock은 각 페이지에 인라인 유지.

export type ProfileLink = { id: string | number; serverId?: string; url: string; label?: string };

export type PlatformKey =
  | 'youtube'
  | 'github'
  | 'linkedin'
  | 'googledrive'
  | 'notion'
  | 'twitter'
  | 'instagram'
  | 'velog'
  | 'tistory'
  | 'medium'
  | 'figma'
  | 'website';

export const PlatformIcon = ({
  k,
  className,
}: {
  k: PlatformKey;
  className?: string;
}) => {
  switch (k) {
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M21.6 7.2c-.2-1-.9-1.7-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3c-1 .2-1.7.9-1.9 1.9C2 9 2 12 2 12s0 3 .4 4.8c.2 1 .9 1.7 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3c1-.2 1.7-.9 1.9-1.9.4-1.8.4-4.8.4-4.8s0-3-.4-4.8zM10 15V9l5.2 3L10 15z" />
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.7.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 6 .5.4.9 1.1.9 2.3v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M19 0H5a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h14a5 5 0 0 0 5-5V5a5 5 0 0 0-5-5zM7 19H4V8h3v11zM5.5 6.5a1.8 1.8 0 1 1 0-3.5 1.8 1.8 0 0 1 0 3.5zM20 19h-3v-5.6c0-1.4-.5-2.4-1.8-2.4-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1.9V19h-3V8h3v1.3a3 3 0 0 1 2.7-1.5c2 0 3.5 1.3 3.5 4V19z" />
        </svg>
      );
    case 'notion':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M4.5 4.4c.7.6 1 .5 2.3.4l12.4-.7c.3 0 0-.3-.1-.3l-2-1.5c-.4-.3-1-.7-2-.6L3.4 2.7c-.4 0-.5.2-.4.4l1.5 1.3zm.7 2.8v13c0 .7.4 1 1.2 1l13.7-.8c.8 0 .9-.5.9-1.1V6.4c0-.6-.2-.9-.7-.9l-14.3.8c-.6 0-.8.3-.8.9zm12.7.7c.1.4 0 .7-.4.8l-.7.1v9.6c-.6.3-1.1.5-1.5.5-.7 0-.9-.2-1.4-.8L9.5 11v6.9l1.4.3s0 .8-1.1.8l-3.1.2c-.1-.2 0-.7.3-.8l.8-.2V8.6l-1.1-.1c-.1-.5.1-1 .7-1l3.4-.2 4.7 7.2V8l-1.2-.1c-.1-.5.3-.9.8-1l3.1-.2z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4 1 .5.4.8.8 1 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.7s0 3.5-.1 4.7c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-1 1.4-.4.5-.8.8-1.4 1-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-1-.5-.4-.8-.8-1-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.4.4-.5.8-.8 1.4-1 .4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.5-1.3.9-.4.4-.7.8-.9 1.3-.2.4-.3 1-.4 2.1C2.5 9.5 2.5 9.9 2.5 12s0 2.5.1 3.7c.1 1.1.2 1.7.4 2.1.2.5.5.9.9 1.3.4.4.8.7 1.3.9.4.2 1 .3 2.1.4 1.2.1 1.6.1 3.7.1s2.5 0 3.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.5 1.3-.9.4-.4.7-.8.9-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-3.7s0-2.5-.1-3.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.5-.9-.9-1.3-.4-.4-.8-.7-1.3-.9-.4-.2-1-.3-2.1-.4C14.5 4 14.1 4 12 4zm0 3.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2zm0 7.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm5.8-7.8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z" />
        </svg>
      );
    case 'velog':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M3 3h18v18H3V3zm6.4 5.5h2.5l1.4 6.4 1.6-6.4h2.4l-2.7 9h-2.7l-2.5-9z" />
        </svg>
      );
    case 'tistory':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="12" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <circle cx="18" cy="12" r="2.5" />
        </svg>
      );
    case 'medium':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M2.4 5.5l1.4 1.4v10.2l-1.4 1.4v.5h4.5v-.5L5.5 17.1V8l5.7 11h.7L17 8.4v9.3l-1 1v.3h6v-.3l-1-1V6.5l1-1V5h-5l-3.6 8.7L9.4 5H2.4v.5z" />
        </svg>
      );
    case 'figma':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M8.5 2h3.5v6H8.5a3 3 0 0 1 0-6zm0 8h3.5v6H8.5a3 3 0 0 1 0-6zm3.5 8v3a3 3 0 1 1-3-3h3zM12 2h3.5a3 3 0 0 1 0 6H12V2zm0 8h3.5a3 3 0 1 1 0 6H12v-6z" />
        </svg>
      );
    case 'googledrive':
      return (
        <svg viewBox="0 0 87.3 78" className={className} aria-hidden>
          <path fill="#0066da" d="M6.6 66.85 3.85 71.6c-.27.5-.27 1.1 0 1.55.5.85 1.4 1.55 2.4 1.85h70.7c1-.3 1.9-1 2.4-1.85.27-.45.27-1.05 0-1.55l-2.75-4.75z" />
          <path fill="#ea4335" d="M73.55 76.85c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" />
          <path fill="#00832d" d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.45-4.45 1.2z" />
          <path fill="#2684fc" d="M59.8 53H27.5L13.75 76.85c1.35.8 2.9 1.15 4.5 1.15h51c1.55 0 3.1-.4 4.45-1.15z" />
          <path fill="#00ac47" d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.45c-.78 1.35-1.2 2.9-1.2 4.45h27.5z" />
          <path fill="#ffba00" d="M73.4 26.5 60.55 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" />
        </svg>
      );
    case 'website':
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
};

export const PLATFORM_META: Record<
  PlatformKey,
  { label: string; bg: string; text: string }
> = {
  youtube: { label: 'YouTube', bg: 'bg-red-600', text: 'text-white' },
  github: { label: 'GitHub', bg: 'bg-gray-900', text: 'text-white' },
  linkedin: { label: 'LinkedIn', bg: 'bg-blue-600', text: 'text-white' },
  googledrive: {
    label: 'Google Drive',
    bg: 'bg-white border border-gray-200',
    text: 'text-gray-900',
  },
  notion: {
    label: 'Notion',
    bg: 'bg-white border border-gray-200',
    text: 'text-gray-900',
  },
  twitter: { label: 'X', bg: 'bg-black', text: 'text-white' },
  instagram: {
    label: 'Instagram',
    bg: 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600',
    text: 'text-white',
  },
  velog: { label: 'Velog', bg: 'bg-emerald-500', text: 'text-white' },
  tistory: { label: 'Tistory', bg: 'bg-orange-500', text: 'text-white' },
  medium: { label: 'Medium', bg: 'bg-black', text: 'text-white' },
  figma: { label: 'Figma', bg: 'bg-gray-800', text: 'text-white' },
  website: { label: 'Website', bg: 'bg-blue-500', text: 'text-white' },
};

export function detectPlatform(url: string): PlatformKey {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'website';
  }
  if (/youtube\.com$|youtu\.be$/.test(host)) return 'youtube';
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
  if (
    host === 'drive.google.com' ||
    host === 'docs.google.com' ||
    host === 'sheets.google.com' ||
    host === 'slides.google.com'
  )
    return 'googledrive';
  if (host.endsWith('notion.so') || host.endsWith('notion.site')) return 'notion';
  if (host === 'twitter.com' || host === 'x.com') return 'twitter';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'velog.io' || host.endsWith('.velog.io')) return 'velog';
  if (host.endsWith('tistory.com')) return 'tistory';
  if (host === 'medium.com' || host.endsWith('.medium.com')) return 'medium';
  if (host === 'figma.com' || host.endsWith('.figma.com')) return 'figma';
  return 'website';
}

export function getDisplayLabel(link: ProfileLink, key: PlatformKey): string {
  if (link.label && link.label.trim()) return link.label.trim();
  return PLATFORM_META[key].label;
}
