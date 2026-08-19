require('dotenv').config();
const path = require('path');
const express = require('express');

const { isValidSido } = require('./lib/stations');
const { handleAir, handleTrend } = require('./lib/handlers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/air', async (req, res) => {
  const sido = String(req.query.sido || '');
  if (!isValidSido(sido)) return res.status(400).json({ error: 'INVALID_SIDO' });
  const { status, body } = await handleAir(sido, { force: req.query.force === '1' });
  res.status(status).json(body);
});

app.get('/api/trend', async (req, res) => {
  const sido = String(req.query.sido || '');
  if (!isValidSido(sido)) return res.status(400).json({ error: 'INVALID_SIDO' });
  const { status, body } = await handleTrend(sido, { force: req.query.force === '1' });
  res.status(status).json(body);
});

app.listen(PORT, () => {
  console.log(`오늘의 공기 서버 실행 중: http://localhost:${PORT}`);
  if (!process.env.AIRKOREA_SERVICE_KEY) {
    console.warn('[경고] AIRKOREA_SERVICE_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  }
});
