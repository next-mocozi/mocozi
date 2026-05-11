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
        // refresh token 자체가 거부된 경우(=401)는 위쪽 /auth/refresh 401 분기에서
        // 이미 토큰 정리 + /login 리다이렉트가 일어남. 여기서 추가로 지우지 않는다.
        // network/abort/timeout/5xx 등 transient 에러에서 토큰을 날리면, 페이지 새로고침
        // 중 in-flight 요청 abort 나 일시적 backend 장애로 매번 로그아웃되는 문제 발생.
        // 토큰을 유지하고 reject 만 → 다음 요청에서 자연 회복.
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
