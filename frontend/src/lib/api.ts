import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  // 백엔드 미연동/응답없음 상황에서 무한 로딩 방지 (8초)
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 토큰 갱신 중복 방지 플래그
let isRefreshing = false;
// 갱신 대기 중인 요청들
let waitingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const flushQueue = (token: string | null, err: unknown = null) => {
  waitingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(err);
  });
  waitingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // refresh 엔드포인트 자체가 401이면 즉시 로그아웃 (무한루프 방지)
    if (error.response?.status === 401 && original.url?.includes('/auth/refresh')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.dispatchEvent(new Event('mocozi:auth-changed'));
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // 인증 엔드포인트(login/register 등)의 401은 비즈니스 결과 — refresh/redirect 안 함
    // 호출자(useAuth.login 등)가 에러 메시지 그대로 표시하도록 reject
    if (error.response?.status === 401 && original.url?.includes('/api/auth/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        localStorage.removeItem('accessToken');
        window.dispatchEvent(new Event('mocozi:auth-changed'));
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 이미 갱신 중이면 대기열에 추가
        return new Promise((resolve, reject) => {
          waitingQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      isRefreshing = true;
      try {
        const res = await api.post('/api/auth/refresh', { refreshToken });
        const { accessToken } = res.data.data;
        localStorage.setItem('accessToken', accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        flushQueue(accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        flushQueue(null, refreshError);
        // ⚠️ 모든 에러에서 토큰 제거하면 안 됨 — 새로고침 도중 refresh 요청 abort, 네트워크 끊김,
        //    5xx 등 transient 에러도 여기 도달함. 그런 경우 토큰 유지 → 다음 새로고침에서 재시도.
        //
        //    401-from-refresh(진짜 refreshToken 만료/위조)는 위 line 47-53에서 이미 정리·redirect됨.
        //    여기 도달했는데 status가 401이면 그건 redundant cleanup (idempotent). 그 외는 transient.
        const status = (refreshError as { response?: { status?: number } })?.response
          ?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.dispatchEvent(new Event('mocozi:auth-changed'));
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
