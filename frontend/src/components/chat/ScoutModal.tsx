'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

/**
 * Phase B-DM-8 Scout C 안 — 공유 스카우트 모달.
 *
 * 진입점: 구인 페이지의 카드, 프로필 페이지의 "스카우트" 버튼, 그 외 향후 위치.
 *
 * 흐름:
 *  1. open=true + targetUser 셋 → /api/teams/my fetch
 *  2. 팀 0개면 alert + 즉시 onClose
 *  3. 팀 1개 이상 → team picker 모달 노출
 *  4. 확인 → POST /api/chat/rooms {context: SCOUT_FROM_TEAM, contextTargetId: teamId}
 *  5. 빈 채팅방으로 push (메시지 작성은 인사양식 패널에서)
 *
 * 부모는 `targetUser`/`open`/`onClose`만 관리. 내부 상태(teams/loading/error)는 모달이 소유.
 */

interface MyTeam {
  id: string;
  name: string;
  teamType: string;
}

interface ScoutModalProps {
  /** 스카우트 대상 사용자. null이면 모달 닫힘. */
  targetUser: { id: string; lastName: string; firstName: string } | null;
  /** 모달 닫기 — 사용자가 X / 배경 / 성공 후 자동 호출 */
  onClose: () => void;
}

export function ScoutModal({ targetUser, onClose }: ScoutModalProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [teamsFetching, setTeamsFetching] = useState(false);

  // open 시 teams fetch
  useEffect(() => {
    if (!targetUser) return;
    let cancelled = false;
    setError(null);
    setSuccess(false);
    setLoading(false);
    setTeamsFetching(true);
    setTeams([]);
    setSelectedTeamId('');

    api
      .get('/api/teams/my')
      .then((res) => {
        if (cancelled) return;
        const list: MyTeam[] = res.data?.data ?? res.data ?? [];
        if (list.length === 0) {
          window.alert(
            '스카우트 채팅을 시작하려면 먼저 본인의 팀을 만들어주세요.\n팀 메뉴에서 새 팀을 생성할 수 있습니다.',
          );
          onClose();
          return;
        }
        setTeams(list);
        setSelectedTeamId(list[0].id);
      })
      .catch(() => {
        if (cancelled) return;
        setError('팀 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setTeamsFetching(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser?.id]);

  if (!targetUser) return null;

  const submit = async () => {
    if (!selectedTeamId) {
      setError('팀을 선택해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Scout C 안 — firstMessage 없이 빈 방 생성. 채팅방 진입 시 인사양식 패널 자동 열림.
      const res = await api.post<{ data: { id: string } }>('/api/chat/rooms', {
        type: 'DIRECT',
        memberIds: [targetUser.id],
        context: 'SCOUT_FROM_TEAM',
        contextTargetId: selectedTeamId,
      });
      const roomId = res.data.data.id;
      setSuccess(true);
      setTimeout(() => {
        onClose();
        router.push(
          `/chat/${roomId}?context=SCOUT_FROM_TEAM&teamId=${selectedTeamId}`,
        );
      }, 600);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(
        err.response?.data?.message ?? '스카우트 채팅 시작에 실패했습니다.',
      );
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-3xl bg-white p-7 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">스카우트 채팅 시작</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            aria-label="닫기"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p className="mb-5 text-sm text-stone-500">
          <span className="font-semibold text-stone-800">{targetUser.lastName + targetUser.firstName}</span>
          님에게 팀 합류를 제안합니다.
        </p>

        {teamsFetching ? (
          <p className="text-sm text-stone-400">팀 정보 불러오는 중...</p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-stone-400">
            팀장으로 등록된 팀이 없습니다. 먼저 팀을 만들어주세요.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                팀 선택
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="input-field"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Phase B-DM-8 Scout C — 메시지 작성은 인사양식 패널에서 */}
            <p className="mb-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              팀 선택 후 채팅방으로 이동하면 인사양식 패널이 자동으로 열려요.
              거기서 메시지를 편집해 보내세요.
            </p>
            {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
            {success ? (
              <p className="text-center text-sm font-semibold text-emerald-600">
                채팅방을 만들었습니다! 잠시 후 이동합니다…
              </p>
            ) : (
              <button
                onClick={submit}
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 py-3 text-sm font-semibold text-white shadow-md shadow-primary-200 transition-all hover:shadow-lg disabled:opacity-60"
              >
                {loading ? '채팅방 생성 중...' : '채팅방 시작'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
