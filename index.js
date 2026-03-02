import 'dotenv/config';
import express from 'express';
import { setupBot } from './bot.js';
import { startScheduler, runMonitoringCycle } from './scheduler.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ bot declared at module scope so all routes can access it
let bot = null;

app.get('/', (req, res) => res.json({ status: 'OpenClaw Agent Running' }));
app.get('/ping', (req, res) => res.send('pong'));

// ✅ Test route — visit in browser to verify Telegram works
app.get('/api/test-telegram', async (req, res) => {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!bot) {
    return res.json({ error: 'Bot not initialized', hint: 'Check TELEGRAM_BOT_TOKEN env var' });
  }
  if (!chatId) {
    return res.json({ error: 'TELEGRAM_CHAT_ID not set' });
  }

  try {
    await bot.telegram.sendMessage(chatId, '✅ Test message from OpenClaw — Telegram is working!');
    res.json({ success: true, chatId });
  } catch (err) {
    res.json({ error: err.message, chatId });
  }
});

// ✅ Test route — verify env vars are loaded
app.get('/api/debug', (req, res) => {
  res.json({
    hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
    hasTelegramChatId: !!process.env.TELEGRAM_CHAT_ID,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    hasGithubToken: !!process.env.GITHUB_TOKEN,
    hasGithubUsername: !!process.env.GITHUB_USERNAME,
    hasVercelToken: !!process.env.VERCEL_TOKEN,
    hasRenderApiKey: !!process.env.RENDER_API_KEY,
    hasCronSecret: !!process.env.CRON_SECRET,
    renderUrl: process.env.RENDER_URL,
    botInitialized: !!bot,
  });
});

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

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    console.log('Initializing Telegram bot...');
    bot = setupBot(token);
    startScheduler(bot);
    console.log('Bot initialized. Chat ID:', process.env.TELEGRAM_CHAT_ID);
  } else {
    console.error('TELEGRAM_BOT_TOKEN is not set — bot will not start.');
  }
});

// import 'dotenv/config';
// import express from 'express';
// import { setupBot } from './bot.js';
// import { startScheduler, runMonitoringCycle } from './scheduler.js';

// const app = express();
// const PORT = process.env.PORT || 3000;

// app.use(express.json());

// app.get('/', (req, res) => res.json({ status: 'OpenClaw Agent Running' }));
// app.get('/ping', (req, res) => res.send('pong'));

// // ✅ Register BEFORE app.listen — not inside it
// const token = process.env.TELEGRAM_BOT_TOKEN;
// let bot = null;

// if (token) {
//   bot = setupBot(token);
//   startScheduler(bot);
// } else {
//   console.error('TELEGRAM_BOT_TOKEN is not set.');
// }
// app.get('/api/test-telegram', async (req, res) => {
//   const chatId = process.env.TELEGRAM_CHAT_ID;
//   const token = process.env.TELEGRAM_BOT_TOKEN;
  
//   if (!chatId || !token) {
//     return res.json({ error: 'Missing TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN', chatId, hasToken: !!token });
//   }

//   try {
//     await bot.telegram.sendMessage(chatId, '✅ Test message from OpenClaw');
//     res.json({ success: true, chatId });
//   } catch (err) {
//     res.json({ error: err.message, chatId });
//   }
// });
// app.post('/api/cron', async (req, res) => {
//   const authHeader = req.headers.authorization;
//   const expectedSecret = process.env.CRON_SECRET;

//   if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }

//   if (!bot) {
//     return res.status(500).json({ error: 'Bot not initialized' });
//   }

//   console.log('Received external cron trigger');
//   runMonitoringCycle(bot).catch(err => console.error('External trigger error:', err));
//   res.json({ status: 'Monitoring cycle triggered' });
// });

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });