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
  cron.schedule('*/14 * * * *', async () => {
    try {
      const renderUrl = process.env.RENDER_URL;
      if (renderUrl) {
        await axios.get(`${renderUrl}/ping`);
        console.log('Self-ping successful');
      }
    } catch (error) {
      console.error('Self-ping failed:', error.message);
    }
  });

  // Morning post at 8 AM UTC
  cron.schedule('0 8 * * *', () => {
    console.log('Running morning monitoring cycle...');
    runMonitoringCycle(bot);
  });

  // Evening post at 6 PM UTC
  cron.schedule('0 18 * * *', () => {
    console.log('Running evening monitoring cycle...');
    runMonitoringCycle(bot);
  });
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
      bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, '✅ Posted to LinkedIn successfully!');
    } else {
      bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, '❌ Failed to post to LinkedIn.');
    }

    // Post to Twitter
    const twitterSuccess = await postToTwitter(twitterContent);
    if (twitterSuccess) {
      bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, '✅ Posted to Twitter successfully!');
    } else {
      bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, '❌ Failed to post to Twitter.');
    }

    // Notify Telegram
    bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, `Monitoring cycle complete.\n\nLinkedIn:\n${linkedInContent}\n\nTwitter:\n${twitterContent}`);

  } catch (error) {
    console.error('Error in monitoring cycle:', error);
    if (bot) {
      bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, `Error in monitoring cycle: ${error.message}`);
    }
  }
}
