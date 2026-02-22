import express from 'express';
import { setupBot } from './bot.js';
import { startScheduler } from './scheduler.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

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
  } else {
    console.error('TELEGRAM_BOT_TOKEN is not set.');
  }
});
