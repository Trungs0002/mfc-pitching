const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MONGODB_URI = process.env.MONGODB_URI;

// Moc gio co dinh GMT+7, moi phep so sanh thoi gian deu lam o server
const DEADLINE = new Date(process.env.DEADLINE || '2026-11-04T15:00:00+07:00');
const SESSION_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 60 * 1000;
const LOCK_MS = 60 * 1000;

app.set('trust proxy', true);
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '100kb' }));

// --- Models ---
const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  sessionStart: Date,
  sessionEnd: Date,
  slot: Number,
  slotSource: String, // 'chosen' | 'random'
  lost: { type: Boolean, default: false },
  lostReason: String, // 'session' | 'deadline' | 'finalize'
  createdAt: { type: Date, default: Date.now },
});
// Moi so chi thuoc ve 1 team, DB chan ghi de ke ca khi 2 request den cung luc
TeamSchema.index({ slot: 1 }, { unique: true, partialFilterExpression: { slot: { $type: 'number' } } });
const Team = mongoose.model('Team', TeamSchema);

// Document duy nhat: co "da random"
const SettingsSchema = new mongoose.Schema({
  _id: String,
  randomDone: { type: Boolean, default: false },
  randomAt: Date,
});
const Settings = mongoose.model('Settings', SettingsSchema);

const AttemptSchema = new mongoose.Schema({
  _id: String,
  count: Number,
  windowStart: Date,
  lockedUntil: Date,
});
const Attempt = mongoose.model('Attempt', AttemptSchema);

// --- DB connection (cached, works for serverless too) ---
let connPromise = null;
function connectDB() {
  if (!MONGODB_URI) return Promise.reject(new Error('MONGODB_URI is not defined'));
  if (!connPromise) {
    connPromise = mongoose
      .connect(MONGODB_URI, { dbName: 'mfc_pitching' })
      .then(() => Team.init())
      .catch((e) => { connPromise = null; throw e; });
  }
  return connPromise;
}

app.get('/health', (req, res) => res.status(200).send('OK'));

app.use(async (req, res, next) => {
  if (!JWT_SECRET || !ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server chưa cấu hình JWT_SECRET / ADMIN_PASSWORD' });
  }
  try {
    await connectDB();
    next();
  } catch (e) {
    console.error('DB error', e.message);
    res.status(500).json({ error: 'Không kết nối được cơ sở dữ liệu' });
  }
});

// --- Helpers ---
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

async function getSettings() {
  try {
    return await Settings.findOneAndUpdate(
      { _id: 'main' },
      { $setOnInsert: { randomDone: false } },
      { upsert: true, new: true }
    );
  } catch (e) {
    if (e.code === 11000) return Settings.findById('main');
    throw e;
  }
}

const NO_SLOT = { slot: { $exists: false } };

function statusOf(t, now) {
  if (t.slot != null && t.slotSource === 'chosen' && t.sessionEnd && t.sessionEnd > now) return 'in_session';
  if (t.slot != null) return t.lost ? 'lost' : 'chosen';
  if (t.lost) return 'waiting';
  if (t.used && t.sessionEnd && t.sessionEnd > now) return 'in_session';
  return 'not_entered';
}

async function freeSlots() {
  const total = await Team.countDocuments();
  const taken = new Set((await Team.find({ slot: { $type: 'number' } }, 'slot').lean()).map((t) => t.slot));
  const free = [];
  for (let i = 1; i <= total; i++) if (!taken.has(i)) free.push(i);
  return { total, free };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Gan ngau nhien cac so con trong cho cac team chua co so. An toan khi chay lai.
async function assignRandom() {
  const teams = await Team.find(NO_SLOT);
  if (!teams.length) return;
  const { free } = await freeSlots();
  shuffle(free);
  const ops = teams.slice(0, free.length).map((t, i) => ({
    updateOne: {
      filter: { _id: t._id, ...NO_SLOT },
      update: { $set: { slot: free[i], slotSource: 'random', lost: true } },
    },
  }));
  try {
    await Team.bulkWrite(ops, { ordered: false });
  } catch (e) {
    if (e.code !== 11000 && !(e.writeErrors || []).every((w) => w.code === 11000)) throw e;
  }
}

// Chay moi khi co request: het phien -> mat luot, qua 15:00 -> mat luot, du dieu kien -> random 1 lan.
// Khong can cron/timer nen chay duoc ca tren serverless.
async function settle() {
  const now = new Date();
  await Team.updateMany(
    { used: true, ...NO_SLOT, lost: { $ne: true }, sessionEnd: { $lte: now } },
    { $set: { lost: true, lostReason: 'session' } }
  );
  if (now >= DEADLINE) {
    await Team.updateMany(
      { used: false, ...NO_SLOT, lost: { $ne: true } },
      { $set: { lost: true, lostReason: 'deadline' } }
    );
  }
  const s = await getSettings();
  const total = await Team.countDocuments();
  if (!s.randomDone) {
    if (total === 0) return;
    // Team da chon nhung con trong phien 10 phut van co the doi so nen chua tinh la xong
    const pending = await Team.countDocuments({
      $or: [
        { ...NO_SLOT, lost: { $ne: true } },
        { slotSource: 'chosen', sessionEnd: { $gt: now } },
      ],
    });
    if (pending > 0) return;
    const claimed = await Settings.findOneAndUpdate(
      { _id: 'main', randomDone: false },
      { $set: { randomDone: true, randomAt: now } }
    );
    if (claimed) await assignRandom();
  } else if (await Team.exists(NO_SLOT)) {
    await assignRandom();
  }
}

// --- Rate limit (luu o Mongo de dung chung giua cac instance) ---
async function lockedFor(key, now) {
  const a = await Attempt.findById(key).lean();
  if (a && a.lockedUntil && a.lockedUntil > now) return Math.ceil((a.lockedUntil - now) / 1000);
  return 0;
}

async function recordFail(key, now) {
  const lockUntil = new Date(now.getTime() + LOCK_MS);
  const expired = {
    $gt: [{ $subtract: [now, { $ifNull: ['$windowStart', now] }] }, FAIL_WINDOW_MS],
  };
  await Attempt.collection.updateOne({ _id: key }, [
    {
      $set: {
        ws: { $cond: [expired, now, { $ifNull: ['$windowStart', now] }] },
        c: { $cond: [expired, 0, { $ifNull: ['$count', 0] }] },
      },
    },
    { $set: { windowStart: '$ws', count: { $add: ['$c', 1] } } },
    { $set: { lockedUntil: { $cond: [{ $gte: ['$count', MAX_FAILS] }, lockUntil, '$lockedUntil'] } } },
    { $unset: ['ws', 'c'] },
  ], { upsert: true });
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  for (;;) {
    const len = 10 + crypto.randomInt(3); // 10-12
    let p = '';
    for (let i = 0; i < len; i++) p += chars[crypto.randomInt(chars.length)];
    if (/[A-Za-z]/.test(p) && /[0-9]/.test(p)) return p;
  }
}

function teamAuth(req, res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  try {
    const p = jwt.verify(m && m[1], JWT_SECRET);
    if (p.kind !== 'team') throw new Error('kind');
    req.teamId = p.teamId;
    next();
  } catch {
    res.status(401).json({ error: 'Phiên đã hết hạn' });
  }
}

// Bang thu tu chi danh cho team da nhap dung mat khau (token van dung duoc sau khi het phien)
async function boardAuth(req, res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  try {
    const p = jwt.verify(m && m[1], JWT_SECRET, { ignoreExpiration: true });
    if (p.kind !== 'team') throw new Error('kind');
    next();
  } catch {
    res.status(401).json({ error: 'Cần nhập mật khẩu để xem bảng' });
  }
}

function adminAuth(req, res, next) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  try {
    const p = jwt.verify(m && m[1], JWT_SECRET);
    if (p.kind !== 'admin') throw new Error('kind');
    next();
  } catch {
    res.status(401).json({ error: 'Chưa đăng nhập admin' });
  }
}

// --- Public ---
app.get('/api/board', boardAuth, wrap(async (req, res) => {
  await settle();
  const now = new Date();
  const s = await getSettings();
  const teams = await Team.find({}, 'name slot slotSource lost').lean();
  const bySlot = new Map(teams.filter((t) => t.slot != null).map((t) => [t.slot, t]));
  const slots = [];
  for (let i = 1; i <= teams.length; i++) {
    const t = bySlot.get(i);
    slots.push({ slot: i, team: t ? t.name : null, by: t ? t.slotSource : null });
  }
  const waiting = teams.filter((t) => t.slot == null && t.lost).map((t) => t.name);
  res.json({ now, deadline: DEADLINE, randomDone: s.randomDone, total: teams.length, slots, waiting });
}));

app.post('/api/enter', wrap(async (req, res) => {
  const now = new Date();
  const password = String(req.body.password || '').trim();
  const key = 'ip:' + req.ip;

  const wait = await lockedFor(key, now);
  if (wait) return res.status(429).json({ error: `Nhập sai quá nhiều lần, vui lòng thử lại sau ${wait} giây` });

  await settle();
  const team = password ? await Team.findOne({ password }) : null;
  if (!team || team.used) {
    await recordFail(key, now);
    return res.status(401).json({ error: 'Mật khẩu không đúng hoặc đã được sử dụng' });
  }
  const s = await getSettings();
  if (now >= DEADLINE) {
    return res.status(403).json({ error: 'Đã quá 15:00 ngày 4/11, mật khẩu đã bị khóa, team mất lượt' });
  }
  if (team.lost || s.randomDone) {
    return res.status(403).json({ error: 'Team đã mất lượt' });
  }

  // Nhieu team co the o trong phien cung luc, tranh so thi DB chan trung (unique index slot).
  // Vao phien: dot mat khau ngay (nguyen tu, chi 1 lan)
  const until = new Date(now.getTime() + SESSION_MS);
  const burned = await Team.findOneAndUpdate(
    { _id: team._id, used: false, lost: { $ne: true }, ...NO_SLOT },
    { $set: { used: true, sessionStart: now, sessionEnd: until } },
    { new: true }
  );
  if (!burned) {
    await recordFail(key, now);
    return res.status(401).json({ error: 'Mật khẩu không đúng hoặc đã được sử dụng' });
  }

  const token = jwt.sign(
    { kind: 'team', teamId: String(team._id) },
    JWT_SECRET,
    { expiresIn: Math.ceil(SESSION_MS / 1000) }
  );
  const { total, free } = await freeSlots();
  res.json({ token, team: { name: team.name }, sessionEnd: until, now: new Date(), total, free });
}));

app.post('/api/pick', teamAuth, wrap(async (req, res) => {
  const now = new Date();
  const slot = Number(req.body.slot);
  const { total, free } = await freeSlots();
  if (!Number.isInteger(slot) || slot < 1 || slot > total) {
    return res.status(400).json({ error: 'Số không hợp lệ' });
  }
  const team = await Team.findById(req.teamId);
  const closed = () => res.status(403).json({
    error: 'Phiên đã hết hạn',
    slot: team && team.slot != null ? team.slot : null,
  });
  // Trong 10 phut cua phien, team duoc doi sang so trong khac. Het gio la chot.
  if (!team || !team.used || !team.sessionEnd || team.sessionEnd <= now || team.lost ||
      (team.slot != null && team.slotSource !== 'chosen')) {
    await settle();
    return closed();
  }
  try {
    const r = await Team.updateOne(
      { _id: team._id, lost: { $ne: true }, sessionEnd: { $gt: now }, $or: [NO_SLOT, { slotSource: 'chosen' }] },
      { $set: { slot, slotSource: 'chosen' } }
    );
    if (!r.matchedCount) return closed();
  } catch (e) {
    if (e.code === 11000) {
      const f = await freeSlots();
      return res.status(409).json({
        error: 'Số này đã có người chọn',
        free: f.free,
        current: team.slot != null ? team.slot : null,
      });
    }
    throw e;
  }
  res.json({ slot, team: { name: team.name } });
}));

// --- Admin ---
app.post('/api/admin/login', wrap(async (req, res) => {
  const now = new Date();
  const key = 'admin:' + req.ip;
  const wait = await lockedFor(key, now);
  if (wait) return res.status(429).json({ error: `Thử lại sau ${wait} giây` });
  const a = Buffer.from(String(req.body.password || ''));
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await recordFail(key, now);
    return res.status(401).json({ error: 'Sai mật khẩu admin' });
  }
  res.json({ token: jwt.sign({ kind: 'admin' }, JWT_SECRET, { expiresIn: '12h' }) });
}));

async function adminState() {
  await settle();
  const now = new Date();
  const s = await getSettings();
  const teams = await Team.find({}).sort({ createdAt: 1 }).lean();
  return {
    now,
    deadline: DEADLINE,
    randomDone: s.randomDone,
    teams: teams.map((t) => ({
      _id: t._id,
      name: t.name,
      password: t.password,
      status: statusOf(t, now),
      slot: t.slot ?? null,
      slotSource: t.slotSource || null,
      used: t.used,
      sessionEnd: t.sessionEnd || null,
    })),
  };
}

app.get('/api/admin/teams', adminAuth, wrap(async (req, res) => {
  res.json(await adminState());
}));

app.post('/api/admin/teams', adminAuth, wrap(async (req, res) => {
  const s = await getSettings();
  if (s.randomDone) return res.status(409).json({ error: 'Đã random, không thể thêm team' });
  const names = [...new Set(
    (Array.isArray(req.body.names) ? req.body.names : String(req.body.names || '').split('\n'))
      .map((n) => String(n).trim())
      .filter(Boolean)
  )];
  if (!names.length) return res.status(400).json({ error: 'Chưa nhập tên team' });
  const skipped = [];
  for (const name of names) {
    let done = false;
    for (let i = 0; i < 5 && !done; i++) {
      try {
        await Team.create({ name, password: genPassword() });
        done = true;
      } catch (e) {
        if (e.code === 11000 && e.keyPattern && e.keyPattern.name) { skipped.push(name); break; }
        if (e.code !== 11000) throw e;
      }
    }
  }
  res.json({ ...(await adminState()), skipped });
}));

app.post('/api/admin/teams/:id/regenerate', adminAuth, wrap(async (req, res) => {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await Team.updateOne(
        { _id: req.params.id, used: false, lost: { $ne: true } },
        { $set: { password: genPassword() } }
      );
      if (!r.matchedCount) return res.status(409).json({ error: 'Team đã vào phiên hoặc mất lượt, không đổi được mật khẩu' });
      return res.json(await adminState());
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  res.status(500).json({ error: 'Không tạo được mật khẩu' });
}));

app.delete('/api/admin/teams/:id', adminAuth, wrap(async (req, res) => {
  const s = await getSettings();
  if (s.randomDone) return res.status(409).json({ error: 'Đã random, không thể xóa team' });
  const r = await Team.deleteOne({ _id: req.params.id, used: false, ...NO_SLOT, lost: { $ne: true } });
  if (!r.deletedCount) return res.status(409).json({ error: 'Chỉ xóa được team chưa vào phiên' });
  res.json(await adminState());
}));

// Chot: cac team chua co so deu mat luot, huy phien dang chay, roi random
app.post('/api/admin/finalize', adminAuth, wrap(async (req, res) => {
  const s = await getSettings();
  if (s.randomDone) return res.status(409).json({ error: 'Đã random rồi' });
  await Team.updateMany(
    { ...NO_SLOT, lost: { $ne: true } },
    { $set: { lost: true, lostReason: 'finalize' } }
  );
  // Team dang trong phien (da chon, co the doi so) cung duoc chot ngay
  await Team.updateMany(
    { slotSource: 'chosen', sessionEnd: { $gt: new Date() } },
    { $set: { sessionEnd: new Date() } }
  );
  res.json(await adminState());
}));

if (require.main === module) {
  app.listen(PORT, () => console.log(`MFC pitching server on port ${PORT}`));
}

module.exports = app;
