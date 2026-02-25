import express from 'express';
import { setupBot } from './bot.js';
import { startScheduler } from './scheduler.js';
import 'dotenv/config';

import { runMonitoringCycle } from './scheduler.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'OpenClaw Agent Running' });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    console.log('Initializing Telegram bot...');
    const bot = setupBot(token);
    startScheduler(bot);

    // Secure Cron Endpoint for GitHub Actions
    app.post('/api/cron', async (req, res) => {
      const authHeader = req.headers.authorization;
      const expectedSecret = process.env.CRON_SECRET;

      if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('Received external cron trigger');
      // Run asynchronously to not timeout the request
      runMonitoringCycle(bot).catch(err => console.error('External trigger error:', err));
      
      res.json({ status: 'Monitoring cycle triggered' });
    });

  } else {
    console.error('TELEGRAM_BOT_TOKEN is not set.');
  }
});
