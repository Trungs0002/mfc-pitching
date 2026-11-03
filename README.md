# MFC Pitching

Web đăng ký thứ tự pitching. Gồm `client/` (React) và `server/` (Express + MongoDB).

## Chạy local

```bash
cd server && cp .env.example .env   # điền MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD
npm install && npm start

cd client && cp .env.example .env
npm install && npm start
```

Trang admin: `/admin`.

## Deploy Vercel

Tạo 2 project Vercel từ cùng repo: một với Root Directory `client`, một với `server`.
Server cần env: `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD` (tùy chọn `CORS_ORIGIN`, `DEADLINE`).
Client cần env: `REACT_APP_API_URL` trỏ tới domain server.
