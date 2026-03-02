import cron from 'node-cron';
import axios from 'axios';
import { getGithubActivity } from './monitor/github.js';
import { getVercelDeployments } from './monitor/vercel.js';
import { getRenderDeploys } from './monitor/render.js';
import { formatForLinkedIn, formatForTwitter } from './formatter.js';
import { postToLinkedIn } from './poster/linkedin.js';
import { postToTwitter } from './poster/twitter.js';

export function startScheduler(bot) {
  console.log('Starting scheduler...');

  // Keep-alive ping every 14 minutes
  // This is still useful to keep the Telegram bot polling active for user interactions
  cron.schedule('*/14 * * * *', async () => {
    try {
      const renderUrl = process.env.RENDER_URL;
      const isPlaceholderUrl = renderUrl?.includes('your-app.onrender.com');

      if (renderUrl && !isPlaceholderUrl) {
        await axios.get(`${renderUrl}/ping`);
        console.log('Self-ping successful');
      } else if (isPlaceholderUrl) {
        console.warn('Self-ping skipped: set RENDER_URL to your deployed Render app URL.');
      }
    } catch (error) {
      console.error('Self-ping failed:', error.message);
    }
  });
}

async function sendTelegramMessage(bot, message) {
  const chatId = bot?.notificationChatId || process.env.TELEGRAM_CHAT_ID;

  if (!bot || !chatId) {
    console.warn('Telegram notification skipped: bot instance or chat ID is missing.');
    return;
  }

  try {
    await bot.telegram.sendMessage(chatId, message);
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message);
  }
}

export async function runMonitoringCycle(bot) {
  try {
    console.log('Fetching data...');
    const github = await getGithubActivity();
    const vercel = await getVercelDeployments();
    const render = await getRenderDeploys();

    const data = { github, vercel, render };

    const linkedInContent = formatForLinkedIn(data);
    const twitterContent = formatForTwitter(data);

    // Post to LinkedIn
    const linkedInSuccess = await postToLinkedIn(linkedInContent);
    if (linkedInSuccess) {
      await sendTelegramMessage(bot, '✅ Posted to LinkedIn successfully!');
    } else {
      await sendTelegramMessage(bot, '❌ Failed to post to LinkedIn.');
    }

    // Post to Twitter
    const twitterSuccess = await postToTwitter(twitterContent);
    if (twitterSuccess) {
      await sendTelegramMessage(bot, '✅ Posted to Twitter successfully!');
    } else {
      await sendTelegramMessage(bot, '❌ Failed to post to Twitter.');
    }

    // Notify Telegram
    await sendTelegramMessage(bot, `Monitoring cycle complete.\n\nLinkedIn:\n${linkedInContent}\n\nTwitter:\n${twitterContent}`);

  } catch (error) {
    console.error('Error in monitoring cycle:', error);
    if (bot) {
      await sendTelegramMessage(bot, `Error in monitoring cycle: ${error.message}`);
    }
  }
}
