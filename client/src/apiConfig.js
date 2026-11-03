// Centralized API Base URL
// It reads from REACT_APP_API_URL environment variable for production (Vercel)
// and defaults to localhost for development.
export const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').trim().replace(/\/+$/, '');

export async function api(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('Không kết nối được máy chủ');
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => null);
  if (res.ok && (data === null || typeof data !== 'object')) {
    // Phan hoi 200 nhung khong phai JSON cua API (vi du REACT_APP_API_URL tro nham)
    const err = new Error('Không kết nối được máy chủ');
    err.status = 0;
    throw err;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Có lỗi xảy ra');
    err.status = res.status;
    err.data = data || {};
    throw err;
  }
  return data;
}

// Loi ket noi hoac loi may chu thi kem dia chi API dang dung de de soat env
export function explain(err) {
  if (err && (err.status === 0 || err.status >= 500)) {
    return `${err.message} (API: ${API_URL}). Kiểm tra REACT_APP_API_URL của client, CORS_ORIGIN và biến môi trường của server.`;
  }
  return err.message;
}
