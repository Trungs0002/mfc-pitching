// Centralized API Base URL
// It reads from REACT_APP_API_URL environment variable for production (Vercel)
// and defaults to localhost for development.
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Có lỗi xảy ra');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
