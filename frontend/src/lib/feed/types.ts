// 피드 페이지 게시물 통합 타입.
// PortfolioItem(프로젝트/연구/스터디/활동/기타) 외에도 경력·대외활동·첫 프로필 게시물을
// 같은 흐름에 노출하기 위해 union 으로 통합. createdAt 내림차순 정렬에 사용.

import type {
  CareerItem,
  Experience,
  PortfolioItem,
} from '@/app/portfolio/_lib';

export type FeedAuthor = {
  userId: string;
  name: string;
  university: string;
  department: string;
  grade: string;
  profileImage?: string | null;
  /** 작성자의 메인 직군 (있을 때만) */
  mainRole?: string;
};

export type FeedPostBase = {
  postId: string;
  author: FeedAuthor;
  /** 게시물 등록 시점 (epoch ms). 정렬 기준. */
  createdAt: number;
  /** 본인 게시물 중 비공개 상태일 때 카드/패널에 안내 표시. mock 사용자는 항상 false. */
  isOwnerPrivate?: boolean;
};

export type FeedPostItem = FeedPostBase & {
  kind: 'item';
  item: PortfolioItem;
  /** backend PortfolioItem.details 통합 객체 (kind: interview|research|study).
   *  타인 viewer 가 작성자 미리보기(사진·마크다운·인터뷰 답변 등) 그대로 볼 수
   *  있도록 본문 sync 시 같이 첨부. 본인 viewer 는 localStorage 에서 별도 로드. */
  rawDetails?: { kind?: string; data?: unknown } | null;
};

export type FeedPostExperience = FeedPostBase & {
  kind: 'experience';
  exp: Experience;
};

export type FeedPostCareer = FeedPostBase & {
  kind: 'career';
  career: CareerItem;
};

export type FeedPostProfile = FeedPostBase & {
  kind: 'profile';
  intro: string;
  skills: string[];
};

export type FeedPost =
  | FeedPostItem
  | FeedPostExperience
  | FeedPostCareer
  | FeedPostProfile;
