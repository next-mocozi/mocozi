'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { UNIVERSITIES } from '@/lib/universities';

/** 회원가입 페이지 */
export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    university: '',
    department: '',
    grade: '',
  });
  const [emailSent, setEmailSent] = useState(false);

  const [uniQuery, setUniQuery] = useState('');
  const [uniOpen, setUniOpen] = useState(false);
  const uniRef = useRef<HTMLDivElement>(null);

  const filteredUnis = uniQuery.trim()
    ? UNIVERSITIES.filter((u) => u.includes(uniQuery.trim()))
    : UNIVERSITIES;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (uniRef.current && !uniRef.current.contains(e.target as Node)) {
        setUniOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      await api.post('/api/auth/register', {
        email: form.email,
        password: form.password,
        name: form.name,
        university: form.university,
        department: form.department,
        grade: form.grade,
      });
      setEmailSent(true);
    } catch (err: any) {
      alert(err.response?.data?.message || '회원가입에 실패했습니다.');
    }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-8">
        <div className="card w-full max-w-md text-center">
          <div className="mb-4 text-5xl">📬</div>
          <h1 className="mb-2 text-2xl font-bold">인증 메일을 발송했습니다</h1>
          <p className="mb-1 text-gray-600">
            <span className="font-medium text-indigo-600">{form.email}</span>로
          </p>
          <p className="mb-6 text-gray-600">
            인증 링크를 보냈습니다. 메일함을 확인해주세요.
          </p>
          <p className="text-xs text-gray-400">
            메일이 오지 않으면 스팸함을 확인하거나{' '}
            <button
              onClick={() => setEmailSent(false)}
              className="text-indigo-500 underline hover:text-indigo-700"
            >
              다시 시도
            </button>
            해주세요.
          </p>
          <div className="mt-6">
            <Link href="/login" className="text-sm text-gray-500 hover:underline">
              로그인 페이지로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-8">
      <div className="card w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold">회원가입</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              대학교 이메일
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="example@university.ac.kr"
              className="input-field"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              .ac.kr 메일만 사용 가능합니다
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              비밀번호
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="8자 이상 입력하세요"
              className="input-field"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              비밀번호 확인
            </label>
            <input
              type="password"
              name="passwordConfirm"
              value={form.passwordConfirm}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력하세요"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              이름
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="이름을 입력하세요"
              className="input-field"
              required
            />
          </div>

          <div ref={uniRef} className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              대학교
            </label>
            <input
              type="text"
              value={uniQuery || form.university}
              onChange={(e) => {
                setUniQuery(e.target.value);
                setForm({ ...form, university: '' });
                setUniOpen(true);
              }}
              onFocus={() => setUniOpen(true)}
              placeholder="대학교명을 검색하세요"
              className="input-field"
              required={!form.university}
              autoComplete="off"
            />
            {uniOpen && filteredUnis.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {filteredUnis.map((u) => (
                  <li
                    key={u}
                    onMouseDown={() => {
                      setForm({ ...form, university: u });
                      setUniQuery('');
                      setUniOpen(false);
                    }}
                    className="cursor-pointer px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {u}
                  </li>
                ))}
              </ul>
            )}
            {form.university && (
              <p className="mt-1 text-xs text-indigo-600">선택됨: {form.university}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              학과
            </label>
            <input
              type="text"
              name="department"
              value={form.department}
              onChange={handleChange}
              placeholder="학과를 입력하세요"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              학년
            </label>
            <select
              name="grade"
              value={form.grade}
              onChange={handleChange}
              className="input-field"
              required
            >
              <option value="">선택</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
              <option value="4">4학년</option>
              <option value="대학원">대학원</option>
            </select>
          </div>

          <button type="submit" className="btn-primary w-full py-3">
            회원가입
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-primary-600 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
