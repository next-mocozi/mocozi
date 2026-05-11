'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangleIcon,
  FileIcon,
  ImageIcon,
  PaperclipIcon,
  XIcon,
} from '@/components/icons/ChatIcons';
import {
  AttachmentDraft,
  buildAttachmentMarker,
  checkPerMessageLimit,
  kindFor,
  uploadSingleAttachment,
  validateAttachment,
  ATTACHMENT_MIME_WHITELIST,
} from '@/lib/chat/attachmentUpload';

interface AttachmentPickerProps {
  roomId: string;
  /** 입력 가능 여부 (연결 끊김 등) — disabled면 클립 버튼 disabled, drag-drop도 무시 */
  disabled?: boolean;
  /** 메시지 전송 후 호출 — picker 상태 초기화용 */
  onClearAttachments?: () => void;
  /**
   * drafts 개수가 변할 때마다 호출 — 전송 버튼 활성 조건 등에 사용.
   * `count > 0`이면 전송 가능 (텍스트 없어도). 디바운싱 X — 즉시.
   */
  onDraftsChange?: (count: number) => void;
}

export interface AttachmentPickerHandle {
  /** 큐의 모든 업로드가 끝나길 대기. 완료된 draft만 marker 문자열 배열로 반환 */
  flushToMarkers(): Promise<string[]>;
  /** 큐에 1개 이상 draft가 있는지 (전송 버튼 활성 결정 등) */
  hasItems(): boolean;
  /** 외부에서 파일 추가 (paste/drop 핸들러 등) */
  addFiles(files: File[]): void;
}

/**
 * 채팅 입력 영역의 첨부 picker — 클립 버튼 + drag-drop + 클립보드 paste.
 *
 * **호출자(부모, ChatInput)가 paste/drop 핸들러를 textarea 등에 attach해서 ref.addFiles()로
 * 전달**해야 함. 이 컴포넌트는 자기 영역(클립 버튼 + drafts UI)만 처리.
 *
 * 동작:
 *  - 파일 선택/추가 시 즉시 검증 → 통과한 것만 큐에 들어감 + 업로드 시작
 *  - 각 파일별 progress bar
 *  - 메시지 전송 시점에 `flushToMarkers()` 호출 → 완료된 것만 markers 반환
 */
export const AttachmentPicker = forwardRef<
  AttachmentPickerHandle,
  AttachmentPickerProps
>(function AttachmentPicker(
  { roomId, disabled = false, onClearAttachments, onDraftsChange },
  ref,
) {
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // flushToMarkers의 polling이 closure-stale 안 보도록 ref로 latest 추적
  const draftsRef = useRef<AttachmentDraft[]>([]);
  useEffect(() => {
    draftsRef.current = drafts;
    onDraftsChange?.(drafts.length);
  }, [drafts, onDraftsChange]);

  // 사용자 추가 (input/paste/drop 공통)
  const addFiles = useCallback(
    (files: File[]) => {
      if (disabled) return;
      setErrorMsg(null);
      if (files.length === 0) return;

      // 유효한 파일만 통과시킴 — 검증 실패 1건이라도 있으면 메시지로 보여주되, 통과 파일은 큐 추가
      const validFiles: File[] = [];
      const errors: string[] = [];
      for (const f of files) {
        const err = validateAttachment(f);
        if (err) {
          errors.push(`${f.name}: ${err}`);
        } else {
          validFiles.push(f);
        }
      }

      // 한 메시지당 한도 검증 (현재 큐 + 추가될 것 합산)
      setDrafts((prev) => {
        const overLimit = checkPerMessageLimit(prev.length, validFiles.length);
        if (overLimit) {
          errors.push(overLimit);
          // 한도 안에서만 추가
          const room = Math.max(0, 10 - prev.length);
          validFiles.splice(room);
        }

        if (errors.length > 0) {
          setErrorMsg(errors.join('\n'));
        }

        if (validFiles.length === 0) return prev;

        const newDrafts: AttachmentDraft[] = validFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          kind: kindFor(file.type),
          status: { state: 'queued' },
        }));
        const next = [...prev, ...newDrafts];

        // 비동기 업로드 트리거 (next setState 이후 fire-and-forget)
        Promise.resolve().then(() => {
          for (const d of newDrafts) {
            void startUpload(d);
          }
        });

        return next;
      });
    },
    // startUpload은 아래 정의 — closure에 setDrafts만 필요
    [disabled, /* startUpload below */],
  );

  // 큐 1건 업로드 — 진행률 갱신 + 완료/실패 상태 반영
  const startUpload = useCallback(
    async (draft: AttachmentDraft) => {
      // 즉시 uploading 상태로
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draft.id
            ? { ...d, status: { state: 'uploading', progress: 0 } }
            : d,
        ),
      );

      try {
        const path = await uploadSingleAttachment(
          draft.file,
          roomId,
          (progress) => {
            setDrafts((prev) =>
              prev.map((d) =>
                d.id === draft.id
                  ? { ...d, status: { state: 'uploading', progress } }
                  : d,
              ),
            );
          },
        );
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id ? { ...d, status: { state: 'done', path } } : d,
          ),
        );
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ??
          (e as Error)?.message ??
          '업로드 실패';
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id
              ? { ...d, status: { state: 'error', message: msg } }
              : d,
          ),
        );
      }
    },
    [roomId],
  );

  // 사용자가 X 클릭으로 제거
  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // 외부 노출 API (parent component가 paste/drop 핸들러로 전달, flush 호출 등)
  useImperativeHandle(
    ref,
    () => ({
      hasItems: () => draftsRef.current.length > 0,
      addFiles,
      flushToMarkers: async () => {
        if (draftsRef.current.length === 0) return [];

        // 모든 uploading이 완료될 때까지 polling. ref로 latest 상태 확인.
        const maxMs = 60_000;
        const start = Date.now();
        while (Date.now() - start < maxMs) {
          const current = draftsRef.current;
          const allDone = current.every(
            (d) => d.status.state === 'done' || d.status.state === 'error',
          );
          if (allDone) break;
          await new Promise((r) => setTimeout(r, 100));
        }

        const final = draftsRef.current;
        const markers: string[] = [];
        for (const d of final) {
          if (d.status.state === 'done') {
            markers.push(
              buildAttachmentMarker(
                d.kind,
                d.status.path,
                d.file.name,
                d.file.size,
                d.file.type,
              ),
            );
          }
        }
        setDrafts([]);
        setErrorMsg(null);
        onClearAttachments?.();
        return markers;
      },
    }),
    [drafts, addFiles, onClearAttachments],
  );

  // 자동 메시지 클리어 (에러 메시지 5초 후 사라짐)
  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 5000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  return (
    <div className="border-t border-stone-200 bg-white">
      {/* 에러 메시지 */}
      {errorMsg && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <pre className="whitespace-pre-wrap font-sans">{errorMsg}</pre>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="ml-auto shrink-0 rounded p-0.5 text-red-600 hover:bg-red-100"
            aria-label="에러 메시지 닫기"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 첨부 큐 표시 */}
      {drafts.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2">
          {drafts.map((d) => (
            <AttachmentChip
              key={d.id}
              draft={d}
              onRemove={() => removeDraft(d.id)}
            />
          ))}
        </div>
      )}

      {/* 클립 버튼 — 입력 row 외부에 두는 게 아니라 ChatInput에서 같이 배치 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept={Array.from(ATTACHMENT_MIME_WHITELIST).join(',')}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          addFiles(files);
          // 같은 파일 재선택 가능하도록 reset
          e.target.value = '';
        }}
      />
    </div>
  );
});

/** 단일 첨부 chip — 미리보기 + progress + 제거 */
function AttachmentChip({
  draft,
  onRemove,
}: {
  draft: AttachmentDraft;
  onRemove: () => void;
}) {
  const isImage = draft.kind === 'image';
  const progress =
    draft.status.state === 'uploading' ? draft.status.progress : null;
  const isDone = draft.status.state === 'done';
  const isError = draft.status.state === 'error';

  return (
    <div
      className={`relative flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
        isError ? 'border-red-300 bg-red-50' : 'border-stone-300 bg-stone-50'
      }`}
      title={draft.file.name}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
          isImage ? 'bg-primary-50 text-primary-600' : 'bg-stone-100 text-stone-600'
        }`}
      >
        {isImage ? (
          <ImageIcon className="h-4 w-4" />
        ) : (
          <FileIcon className="h-4 w-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="max-w-[10rem] truncate font-medium text-stone-800">
          {draft.file.name}
        </span>
        <span className="text-[0.65rem] text-stone-500">
          {draft.status.state === 'error'
            ? draft.status.message
            : isDone
              ? '업로드 완료'
              : progress !== null
                ? `${Math.round(progress * 100)}%`
                : '대기 중'}
        </span>
        {/* progress bar */}
        {progress !== null && !isDone && !isError && (
          <span className="mt-0.5 block h-1 w-32 overflow-hidden rounded bg-stone-200">
            <span
              className="block h-full bg-primary-500 transition-all duration-100"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
        aria-label="첨부 제거"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * 외부에서 클립 버튼 클릭으로 file input 열기. AttachmentPicker가 file input을 hidden으로
 * 갖고 있으므로 ref 통해 클릭 trigger. parent component(ChatInput)에서 사용.
 */
export function AttachmentClipButton({
  picker,
  disabled,
}: {
  picker: React.RefObject<AttachmentPickerHandle | null>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        // file input은 AttachmentPicker 내부 — 클릭으로 trigger 위해 DOM 조회
        const input = document.querySelector<HTMLInputElement>(
          'input[type="file"][hidden]',
        );
        input?.click();
      }}
      disabled={disabled}
      className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="파일 첨부"
      title="파일 첨부"
    >
      <PaperclipIcon className="h-5 w-5" />
    </button>
  );
}
