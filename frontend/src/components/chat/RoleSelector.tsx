'use client';

interface RoleSelectorProps {
  /** 팀이 모집 중인 직군 목록 (TeamProposal.recruitingRoles) */
  roles: string[];
  /** 직군 선택 콜백 */
  onSelect: (role: string) => void;
}

/**
 * RECRUIT_TEAM 컨텍스트의 첫 단계 — 팀 모집 직군 중 1개 선택.
 *
 * 사용처: SlidingPanel 안에서 step 1로 표시. 선택 시 step 2(TemplatePreview)로 전환.
 *
 * 표시 정책:
 *  - 모집 직군이 비어있으면 "팀에서 모집 중인 직군이 없어요" + 직접 입력 입력란
 *  - 직군 1개면 자동 선택 후 다음 단계로 (UI 생략)는 부모가 처리 — 여기는 항상 선택지 표시
 */
export function RoleSelector({ roles, onSelect }: RoleSelectorProps) {
  if (roles.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          팀에서 명시한 모집 직군이 없습니다. 어떤 분야로 지원하시는지 입력해주세요.
        </p>
        <input
          type="text"
          placeholder="예: PM, Frontend"
          className="input-field w-full"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const value = (e.target as HTMLInputElement).value.trim();
              if (value) onSelect(value);
            }
          }}
        />
        <p className="text-xs text-gray-500">엔터로 다음 단계 진행</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800">
        어떤 분야로 지원하시나요?
      </p>
      <p className="text-xs text-gray-500">
        선택한 직군이 첫 메시지의 양식에 자동으로 들어갑니다.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onSelect(role)}
            className="border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}
