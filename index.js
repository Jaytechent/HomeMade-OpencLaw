import 'dotenv/config';
import express from 'express';
import { setupBot } from './bot.js';
import { startScheduler, runMonitoringCycle } from './scheduler.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'OpenClaw Agent Running' }));
app.get('/ping', (req, res) => res.send('pong'));

// ✅ Register BEFORE app.listen — not inside it
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

if (token) {
  bot = setupBot(token);
  startScheduler(bot);
} else {
  console.error('TELEGRAM_BOT_TOKEN is not set.');
}

app.post('/api/cron', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!bot) {
    return res.status(500).json({ error: 'Bot not initialized' });
  }

  console.log('Received external cron trigger');
  runMonitoringCycle(bot).catch(err => console.error('External trigger error:', err));
  res.json({ status: 'Monitoring cycle triggered' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});