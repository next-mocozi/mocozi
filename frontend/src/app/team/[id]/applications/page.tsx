'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

interface Application {
  id: string;
  status: ApplicationStatus;
  message: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    university: string;
    department: string;
    skills: string[];
  };
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDING: '검토 중',
  ACCEPTED: '수락',
  REJECTED: '거절',
};

const STATUS_CLASS: Record<ApplicationStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-600 border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-400 border-red-200',
};

export default function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/api/apply/${id}/applications`)
      .then((res) => setApplications(res.data?.data ?? res.data ?? []))
      .catch((err) => {
        if (err.response?.status === 403 || err.response?.status === 400) {
          router.replace(`/team/${id}`);
        } else {
          setError('지원자 목록을 불러오지 못했습니다.');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (applicationId: string, status: 'ACCEPTED' | 'REJECTED') => {
    setProcessingId(applicationId);
    try {
      await api.patch(`/api/apply/applications/${applicationId}/${status}`);
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status } : a)),
      );
    } catch (err: any) {
      alert(err?.response?.data?.message ?? '처리에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  };

  const pending = applications.filter((a) => a.status === 'PENDING');
  const processed = applications.filter((a) => a.status !== 'PENDING');

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-red-400">{error}</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/team/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-stone-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        팀으로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl md:text-4xl">지원자 목록</h1>
        <span className="bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600">
          대기 {pending.length}명
        </span>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border border-stone-100 bg-white py-16 text-center shadow-sm">
          <p className="text-3xl">📭</p>
          <p className="font-semibold text-stone-700">아직 지원자가 없습니다</p>
          <p className="text-sm text-stone-400">지원자가 생기면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">검토 대기</p>
              {pending.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  processingId={processingId}
                  onAccept={() => updateStatus(app.id, 'ACCEPTED')}
                  onReject={() => updateStatus(app.id, 'REJECTED')}
                />
              ))}
            </div>
          )}
          {processed.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">처리 완료</p>
              {processed.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  processingId={processingId}
                  onAccept={() => updateStatus(app.id, 'ACCEPTED')}
                  onReject={() => updateStatus(app.id, 'REJECTED')}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  app,
  processingId,
  onAccept,
  onReject,
}: {
  app: Application;
  processingId: string | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isProcessing = processingId === app.id;

  return (
    <div className="border border-stone-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-indigo-50 text-sm font-semibold text-indigo-600">
            {app.user.lastName[0]}
          </div>
          <div>
            <p className="font-semibold text-stone-800">{app.user.lastName + app.user.firstName}</p>
            <p className="text-xs text-stone-400">{app.user.university} · {app.user.department}</p>
          </div>
        </div>
        <span className={`border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[app.status]}`}>
          {STATUS_LABEL[app.status]}
        </span>
      </div>

      {app.user.skills.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {app.user.skills.slice(0, 5).map((skill) => (
            <span key={skill} className="bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
              {skill}
            </span>
          ))}
          {app.user.skills.length > 5 && (
            <span className="bg-stone-100 px-2 py-0.5 text-xs text-stone-400">
              +{app.user.skills.length - 5}
            </span>
          )}
        </div>
      )}

      <p className="mb-4 bg-stone-50 px-4 py-3 text-sm leading-relaxed text-stone-600">
        {app.message}
      </p>

      {app.status === 'PENDING' && (
        <div className="flex gap-2">
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="flex-1 border border-stone-200 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            거절
          </button>
          <button
            onClick={onAccept}
            disabled={isProcessing}
            className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            {isProcessing ? '처리 중...' : '수락'}
          </button>
        </div>
      )}

      {app.status === 'ACCEPTED' && (
        <Link
          href={`/profile/${app.user.id}`}
          className="block text-center text-xs text-indigo-500 hover:underline"
        >
          프로필 보기 →
        </Link>
      )}
    </div>
  );
}
