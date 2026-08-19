require('dotenv').config();
const { isValidSido } = require('../lib/stations');
const { handleAir } = require('../lib/handlers');

module.exports = async (req, res) => {
  const sido = String(req.query.sido || '');
  if (!isValidSido(sido)) {
    res.status(400).json({ error: 'INVALID_SIDO' });
    return;
  }
  const { status, body } = await handleAir(sido, { force: req.query.force === '1' });
  res.status(status).json(body);
};
