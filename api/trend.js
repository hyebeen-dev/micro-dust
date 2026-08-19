require('dotenv').config();
const { isValidSido } = require('../lib/stations');
const { handleTrend } = require('../lib/handlers');

module.exports = async (req, res) => {
  const sido = String(req.query.sido || '');
  if (!isValidSido(sido)) {
    res.status(400).json({ error: 'INVALID_SIDO' });
    return;
  }
  const { status, body } = await handleTrend(sido, { force: req.query.force === '1' });
  res.status(status).json(body);
};
