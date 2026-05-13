'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, UserIcon, XIcon } from '@/components/icons/ChatIcons';
import api from '@/lib/api';
import type { ChatRoomWithMembers } from '@/types/chat';

/**
 * 새 채팅 만들기 모달
 *
 * 동작:
 *  - 열릴 때 GET /api/search/users 로 사용자 목록 fetch (본인 제외)
 *  - 체크박스로 다중 선택
 *  - 선택 1명 → DIRECT (자동 find-or-create — 같은 양자 방 있으면 그 방 반환)
 *  - 선택 2명 이상 → GROUP (방 이름 필수)
 *  - POST /api/chat/rooms → 성공 시 onCreated(room) 호출
 *
 * UI는 임시 폴백 디자인 (변경 여지 있음).
 */

interface UserCard {
  id: string;
  lastName: string;
  firstName: string;
  university: string;
  department: string;
  profileImage: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (room: ChatRoomWithMembers) => void;
  myId: string | undefined;
}

export function NewChatModal({ open, onClose, onCreated, myId }: Props) {
  const [users, setUsers] = useState<UserCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때마다 사용자 목록 새로 로드 + 상태 리셋
  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setGroupName('');
    setError(null);
    setLoadingUsers(true);
    api
      .get<{ data: UserCard[] }>('/api/search/users')
      .then((res) => setUsers(res.data.data))
      .catch(() => setError('사용자 목록을 불러오지 못했습니다.'))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  if (!open) return null;

  const others = users.filter((u) => u.id !== myId);
  const selectedCount = selectedIds.size;
  const isGroup = selectedCount >= 2;
  const canCreate =
    selectedCount >= 1 &&
    (!isGroup || groupName.trim().length > 0) &&
    !creating;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const memberIds = Array.from(selectedIds);
      const payload = isGroup
        ? { type: 'GROUP' as const, name: groupName.trim(), memberIds }
        : { type: 'DIRECT' as const, memberIds };
      const res = await api.post<{ data: ChatRoomWithMembers }>(
        '/api/chat/rooms',
        payload,
      );
      onCreated(res.data.data);
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? '채팅방 생성에 실패했습니다.';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold">새 채팅</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* GROUP 이름 입력 — 2명 이상 선택 시만 */}
        {isGroup && (
          <div className="border-b border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700">
              그룹 이름
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="예: 디자인 팀"
                maxLength={80}
                className="mt-1 w-full border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>
        )}

        {/* 사용자 목록 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loadingUsers && (
            <div className="p-4 text-center text-sm text-gray-500">
              사용자 불러오는 중…
            </div>
          )}

          {!loadingUsers && others.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500">
              표시할 사용자가 없습니다.
            </div>
          )}

          {!loadingUsers &&
            others.map((u) => {
              const checked = selectedIds.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggle(u.id)}
                  className={`flex w-full items-center gap-3 p-2 text-left transition ${
                    checked ? 'bg-primary-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center bg-gray-100 text-gray-500">
                    {u.profileImage ? (
                      <img
                        src={u.profileImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{u.lastName + u.firstName}</div>
                    <div className="truncate text-xs text-gray-500">
                      {u.university} · {u.department}
                    </div>
                  </div>
                  <div
                    className={`flex h-5 w-5 items-center justify-center border ${
                      checked
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-gray-300'
                    }`}
                  >
                    {checked && <CheckIcon className="h-3.5 w-3.5" />}
                  </div>
                </button>
              );
            })}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 p-4">
          {error && (
            <div className="mb-3 border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {selectedCount === 0
                ? '대화 상대를 선택하세요'
                : selectedCount === 1
                  ? '1:1 대화 (DIRECT)'
                  : `${selectedCount}명 그룹 채팅 (GROUP)`}
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={!canCreate}
              className="btn-primary disabled:opacity-50"
            >
              {creating ? '생성 중…' : '대화 시작'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
