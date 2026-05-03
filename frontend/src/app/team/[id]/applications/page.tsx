'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Application {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
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

const STATUS_LABEL: Record<string, string> = {
  PENDING: '검토 중',
  ACCEPTED: '수락됨',
  REJECTED: '거절됨',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
};

export default function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: teamId } = use(params);
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/api/apply/${teamId}/applications`)
      .then((res) => setApplications(res.data.data))
      .catch((err) => {
        if (err.response?.status === 400) {
          router.replace(`/team/${teamId}`);
        } else {
          setError('지원자 목록을 불러올 수 없습니다.');
        }
      })
      .finally(() => setLoading(false));
  }, [teamId, router]);

  const updateStatus = async (applicationId: string, status: 'ACCEPTED' | 'REJECTED') => {
    setProcessing(applicationId);
    try {
      await api.patch(`/api/apply/applications/${applicationId}/${status}`);
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status } : a))
      );
      if (status === 'ACCEPTED') router.refresh();
    } catch {
      setError('처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/team/${teamId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 팀으로 돌아가기
      </Link>
      <h1 className="mb-6 text-2xl font-bold">지원자 목록</h1>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {applications.length === 0 ? (
        <div className="card py-12 text-center text-gray-400">
          아직 지원자가 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/profile/${app.user.id}`}
                    className="font-semibold hover:text-blue-600 hover:underline"
                  >
                    {app.user.name}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {app.user.university} · {app.user.department}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[app.status]}`}
                >
                  {STATUS_LABEL[app.status]}
                </span>
              </div>

              {app.user.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {app.user.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                {app.message}
              </div>

              {app.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(app.id, 'ACCEPTED')}
                    disabled={processing === app.id}
                    className="flex-1 rounded-full bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => updateStatus(app.id, 'REJECTED')}
                    disabled={processing === app.id}
                    className="flex-1 rounded-full border border-red-200 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-60"
                  >
                    거절
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
