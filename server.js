require('dotenv').config();
const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const db       = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;

// ── Multer（メモリ保存 → Supabase Storage へアップロード） ──
const memStorage = multer.memoryStorage();

const uploadAvatar = multer({
  storage: memStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('画像ファイルのみ受け付けます'));
  }
});

const upload = multer({
  storage: memStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith('audio/')
      ? cb(null, true)
      : cb(new Error('音声ファイルのみ受け付けます'));
  }
});

// ── ミドルウェア ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hakkyoi-nokotta-sumo-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public')));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: 'ログインが必要です' });
  next();
};

// ── Storage ヘルパー ──────────────────────────────────────────
function audioStorageUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/audio/${filename}`;
}

function avatarStorageUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${filename}`;
}

function audioExt(mimetype) {
  if (mimetype.includes('mp4'))  return '.mp4';
  if (mimetype.includes('ogg'))  return '.ogg';
  return '.webm';
}

function imageExt(mimetype) {
  if (mimetype.includes('png'))  return '.png';
  if (mimetype.includes('gif'))  return '.gif';
  if (mimetype.includes('webp')) return '.webp';
  return '.jpg';
}

// ════════════════════════════════════════════════════════════════
// 認証 API
// ════════════════════════════════════════════════════════════════

// 新規登録
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password)
      return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });

    const u = username.trim();
    if (u.length < 2 || u.length > 20)
      return res.status(400).json({ error: 'ユーザー名は2〜20文字で入力してください' });
    if (password.length < 6)
      return res.status(400).json({ error: 'パスワードは6文字以上で入力してください' });

    const hash = await bcrypt.hash(password, 10);
    const user = await db.createUser(u, hash);

    req.session.userId   = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    if (err.code === 'UNIQUE')
      return res.status(400).json({ error: 'そのユーザー名はすでに使われています' });
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ログイン
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください' });

    const user = await db.findUserByName(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });

    req.session.userId   = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ログアウト
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// 現在のユーザー確認
app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.json({ userId: null });
  const user = await db.findUserById(req.session.userId);
  res.json({
    userId:      req.session.userId,
    username:    req.session.username,
    avatar:      user?.avatar        || '力',
    avatarColor: user?.avatar_color  || '#c0392b',
    avatarImage: user?.avatar_image  || null,
    catchphrase: user?.catchphrase   || ''
  });
});

// プロフィール更新（テキスト情報）
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { avatar, avatarColor, catchphrase } = req.body;
    const updated = await db.updateUserProfile(req.session.userId, { avatar, avatarColor, catchphrase });
    if (!updated) return res.status(404).json({ error: 'ユーザーが見つかりません' });
    res.json({
      success: true,
      avatar:      updated.avatar,
      avatarColor: updated.avatar_color,
      avatarImage: updated.avatar_image || null,
      catchphrase: updated.catchphrase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// アバター画像アップロード
app.post('/api/auth/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '画像ファイルが必要です' });

    const ext      = imageExt(req.file.mimetype);
    const filename = `user_${req.session.userId}${ext}`;

    const exts = ['.jpg', '.png', '.gif', '.webp'];
    await db.supabase.storage.from('avatars').remove(exts.map(e => `user_${req.session.userId}${e}`));

    const { error } = await db.supabase.storage.from('avatars').upload(filename, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true,
    });
    if (error) throw error;

    const avatarUrl = avatarStorageUrl(filename);
    const updated   = await db.updateUserProfile(req.session.userId, { avatarImage: avatarUrl });
    if (!updated) return res.status(404).json({ error: 'ユーザーが見つかりません' });

    res.json({ success: true, avatarImage: avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// アバター画像削除
app.delete('/api/auth/avatar', requireAuth, async (req, res) => {
  try {
    const exts = ['.jpg', '.png', '.gif', '.webp'];
    await db.supabase.storage.from('avatars').remove(exts.map(e => `user_${req.session.userId}${e}`));
    await db.updateUserProfile(req.session.userId, { avatarImage: '' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ════════════════════════════════════════════════════════════════
// ランキング API
// ════════════════════════════════════════════════════════════════

// ランキング取得
app.get('/api/rankings', async (req, res) => {
  try {
    const rankings = await db.getRankings(100);
    const results  = await Promise.all(rankings.map(async (r, i) => {
      const user = r.user_id ? await db.findUserById(r.user_id) : null;
      return {
        rank:        i + 1,
        id:          r.id,
        username:    r.username,
        decibel:     r.decibel,
        hasAudio:    !!(r.audio_public && r.audio_filename),
        audioUrl:    r.audio_public && r.audio_filename ? `/api/audio/${r.audio_filename}` : null,
        createdAt:   r.created_at,
        isOwn:       req.session.userId ? (Number(req.session.userId) === Number(r.user_id)) : false,
        avatar:      user?.avatar       || null,
        avatarColor: user?.avatar_color || null,
        avatarImage: user?.avatar_image || null,
      };
    }));
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// スコア登録
app.post('/api/rankings', upload.single('audio'), async (req, res) => {
  let audioFilename = null;
  try {
    const { username, decibel, audioPublic } = req.body;

    if (!username?.trim() || !decibel)
      return res.status(400).json({ error: '必要な情報が不足しています' });

    const dbVal = parseFloat(decibel);
    if (isNaN(dbVal) || dbVal < 0 || dbVal > 200)
      return res.status(400).json({ error: '無効なデシベル値です' });

    const isPublic = audioPublic === 'true';
    let audioMimetype = null;

    if (req.file && isPublic) {
      const ext = audioExt(req.file.mimetype);
      audioFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
      audioMimetype = req.file.mimetype;

      const { error } = await db.supabase.storage.from('audio').upload(audioFilename, req.file.buffer, {
        contentType: req.file.mimetype,
      });
      if (error) throw error;
    }

    const item = await db.addRanking({
      user_id:        req.session.userId || null,
      username:       username.trim(),
      decibel:        dbVal,
      audio_public:   isPublic ? 1 : 0,
      audio_filename: audioFilename,
      audio_mimetype: audioMimetype,
    });

    if (req.session.userId) {
      const season = await db.getSeasonInfo();
      await db.addUserRecord({
        user_id:        req.session.userId,
        username:       username.trim(),
        decibel:        dbVal,
        audio_public:   isPublic ? 1 : 0,
        audio_filename: audioFilename,
        audio_mimetype: audioMimetype,
        season_number:  season?.seasonNumber || 1,
      });
    }

    const all  = await db.getRankings(1000);
    const rank = all.findIndex(r => r.id === item.id) + 1;

    res.json({ success: true, id: item.id, rank });
  } catch (err) {
    console.error(err);
    if (audioFilename) {
      await db.supabase.storage.from('audio').remove([audioFilename]).catch(() => {});
    }
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// スコア削除（ログイン必須・自分のみ）
app.delete('/api/rankings/:id', requireAuth, async (req, res) => {
  try {
    const id      = parseInt(req.params.id);
    const ranking = await db.findRankingById(id);

    if (!ranking)
      return res.status(404).json({ error: '記録が見つかりません' });
    if (ranking.user_id !== req.session.userId)
      return res.status(403).json({ error: '自分の記録のみ削除できます' });

    if (ranking.audio_filename) {
      await db.supabase.storage.from('audio').remove([ranking.audio_filename]).catch(() => {});
      await db.clearAudioFromHistory(ranking.audio_filename);
    }

    await db.deleteRanking(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// ════════════════════════════════════════════════════════════════
// 音声ファイル配信（Supabase Storage へリダイレクト）
// ════════════════════════════════════════════════════════════════
app.get('/api/audio/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const all      = await db.getRankings(1000);
    const ranking  = all.find(r => r.audio_filename === filename && r.audio_public === 1);

    if (!ranking) return res.status(404).send('Not found');

    res.redirect(audioStorageUrl(filename));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ════════════════════════════════════════════════════════════════
// シーズン管理
// ════════════════════════════════════════════════════════════════

async function checkAndResetSeason() {
  const season = await db.getSeasonInfo();
  if (!season) return;
  if (new Date() > new Date(season.nextResetAt)) {
    console.log(`\n⏰ シーズン${season.seasonNumber}リセット実行中...`);
    const newSeason = await db.archiveAndResetRankings();
    if (newSeason) {
      console.log(`✅ シーズン${newSeason.seasonNumber}開始！ 次回リセット: ${newSeason.nextResetAt}\n`);
    }
  }
}

// ローカル・Railway環境のみ定期チェック
if (require.main === module) {
  checkAndResetSeason().catch(console.error);
  setInterval(() => checkAndResetSeason().catch(console.error), 60 * 60 * 1000);
}

// シーズン情報取得
app.get('/api/season', async (req, res) => {
  try {
    const season = await db.getSeasonInfo();
    res.json(season || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

// ════════════════════════════════════════════════════════════════
// ユーザー個人履歴
// ════════════════════════════════════════════════════════════════

app.get('/api/users/me/history', requireAuth, async (req, res) => {
  try {
    const records = await db.getUserRecords(req.session.userId, 50);
    res.json(records.map(r => ({
      id:           r.id,
      decibel:      r.decibel,
      hasAudio:     !!(r.audio_public && r.audio_filename),
      audioUrl:     r.audio_public && r.audio_filename ? `/api/audio/${r.audio_filename}` : null,
      createdAt:    r.created_at,
      seasonNumber: r.season_number || 1,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🏟️  発狂ーぃ のこった！ サーバー起動`);
    console.log(`   http://localhost:${PORT}\n`);
  });
}

module.exports = app;