import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new Anthropic();

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `あなたは文章分析の専門家です。日本語の長文を論理構造に基づいて分析し、宇宙システム（太陽・惑星・衛星）として視覚化するためのJSONを生成します。
必ず有効なJSON形式のみを返してください。説明文、前置き、コードブロック記号（\`\`\`）は不要です。`;

function buildPrompt(text) {
  return `以下の長文を分析し、指定のJSON形式のみで返してください。

【長文】
${text}

【出力フォーマット】
{
  "sun_summary": "長文全体の核心テーマ（40〜60文字以内）",
  "sentiment": "neutral",
  "planets": [
    {
      "type": "conclusion",
      "label": "結論",
      "text": "40〜60文字以内",
      "conjunction_in": "つまり",
      "satellites": []
    },
    {
      "type": "reason",
      "label": "理由",
      "text": "40〜60文字以内",
      "conjunction_in": "なぜなら",
      "satellites": []
    },
    {
      "type": "example",
      "label": "具体例",
      "text": "40〜60文字以内",
      "conjunction_in": "例えば",
      "satellites": []
    },
    {
      "type": "summary",
      "label": "まとめ",
      "text": "40〜60文字以内",
      "conjunction_in": "まとめると",
      "bullets": ["要点1（20〜35文字）", "要点2（20〜35文字）", "要点3（20〜35文字）"],
      "satellites": []
    }
  ]
}

【惑星を増やすルール】（重要）
- 長文に明確に異なる理由が複数ある → type:"reason" の惑星を複数追加、label は「理由①」「理由②」
- 長文に重要な具体例が複数ある → type:"example" の惑星を複数追加、label は「具体例①」「具体例②」
- 長文が複数の独立した話題を含む → type:"topic" の惑星を追加、label は話題名
- 合計惑星数は4〜7個、必ず summary が最後
- 惑星が多い場合は内容をより凝縮して40文字に近づける

【厳守ルール】
- sun_summary と各 text は必ず40〜60文字以内
- satellites は各惑星に0〜2個まで
- bullets は3〜5個、各20〜35文字以内
- conjunction_in は2〜8文字の接続詞
- sentiment は必ず "positive"（前向き・希望・成功・喜びなど）/ "negative"（問題・批判・悲しみ・失敗など）/ "neutral"（事実説明・中立・判断しにくい）のいずれか1つ
- satellites の conjunction は2〜6文字の接続詞
- 全て日本語で記述
- 有効なJSONのみ返すこと（余計な文章・マークダウン記号一切不要）`;
}

const MUSIC_FILES = {
  bgm:      path.join(__dirname, 'music', 'bgm.mp3'),
  positive: path.join(__dirname, 'music', 'positive.wav'),
  neutral:  path.join(__dirname, 'music', 'neutral.wav'),
  negative: path.join(__dirname, 'music', 'negative.wav'),
};
function serveMusic(key) {
  return (req, res) => {
    const file = MUSIC_FILES[key];
    if (!existsSync(file)) return res.status(404).end();
    res.sendFile(file);
  };
}
app.get('/music',          serveMusic('bgm'));
app.get('/music/positive', serveMusic('positive'));
app.get('/music/neutral',  serveMusic('neutral'));
app.get('/music/negative', serveMusic('negative'));

app.post('/api/analyze', async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: '長文を入力してください' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send({ type: 'start' });

    let fullText = '';

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(text) }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          send({ type: 'progress' });
        }
      }
    }

    // JSON extraction
    let jsonStr = fullText.trim();

    // Remove code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    // Try to extract the outermost JSON object
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    const parsed = JSON.parse(jsonStr);
    send({ type: 'result', data: parsed });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🪐 長文プラネット: http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY が未設定です。.env または環境変数で設定してください。');
  }
});
