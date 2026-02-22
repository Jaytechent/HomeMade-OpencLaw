import { Telegraf } from 'telegraf';
import { runMonitoringCycle } from './scheduler.js';
import { getGithubActivity } from './monitor/github.js';
import { getVercelDeployments } from './monitor/vercel.js';
import { getRenderDeploys } from './monitor/render.js';
import { formatForLinkedIn, formatForTwitter } from './formatter.js';
import { handleGeminiChat } from './gemini.js';

let isPaused = false;

export function setupBot(token) {
  const bot = new Telegraf(token);

  bot.start((ctx) => {
    ctx.reply('Welcome to OpenClaw Agent! 🤖\n\nCommands:\n/status - Check agent status\n/trigger - Run monitoring cycle now\n/preview - Preview next post\n/pause - Pause auto-posting\n/resume - Resume auto-posting\n\nSend me any message to chat with my Gemini brain! 🧠');
  });

  bot.command('status', (ctx) => {
    ctx.reply(`Agent is running.\nAuto-posting is ${isPaused ? 'PAUSED ⏸️' : 'ACTIVE ✅'}\nLast check: ${new Date().toLocaleString()}`);
  });

  bot.command('trigger', async (ctx) => {
    ctx.reply('Triggering monitoring cycle...');
    await runMonitoringCycle(bot);
    ctx.reply('Cycle complete.');
  });

  bot.command('preview', async (ctx) => {
    ctx.reply('Generating preview...');
    try {
      const github = await getGithubActivity();
      const vercel = await getVercelDeployments();
      const render = await getRenderDeploys();

      const data = { github, vercel, render };
      const linkedInContent = formatForLinkedIn(data);
      const twitterContent = formatForTwitter(data);

      ctx.reply(`LinkedIn Preview:\n\n${linkedInContent}`);
      ctx.reply(`Twitter Preview:\n\n${twitterContent}`);
    } catch (error) {
      ctx.reply(`Error generating preview: ${error.message}`);
    }
  });

  bot.command('pause', (ctx) => {
    isPaused = true;
    ctx.reply('Auto-posting paused.');
  });

  bot.command('resume', (ctx) => {
    isPaused = false;
    ctx.reply('Auto-posting resumed.');
  });

  // Handle free text messages with Gemini
  bot.on('text', async (ctx) => {
    // Ignore commands (starting with /)
    if (ctx.message.text.startsWith('/')) return;

    ctx.sendChatAction('typing');
    const response = await handleGeminiChat(ctx.message.text);
    ctx.reply(response);
  });

  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}
