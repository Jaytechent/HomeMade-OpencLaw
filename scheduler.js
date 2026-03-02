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
    await sendTelegramMessage(bot, '🔄 Running monitoring cycle...');

    console.log('Fetching data...');
    const github = await getGithubActivity();
    const vercel = await getVercelDeployments();
    const render = await getRenderDeploys();

    const data = { github, vercel, render };

    // Clean activity digest
    const totalCommits = github?.commits || 0;
    const totalDeploys = (vercel?.deployments?.length || 0) + (render?.deploys?.length || 0);

    let report = `📊 Activity Digest — ${new Date().toLocaleString()}\n\n`;

    if (totalCommits > 0) {
      report += `🐙 GitHub: ${totalCommits} commits → ${github.repoNames?.join(', ')}\n`;
    } else {
      report += `🐙 GitHub: No commits today\n`;
    }

    if (vercel?.deployments?.length > 0) {
      report += `▲ Vercel: ${vercel.deployments.map(d => `${d.project} (${d.state})`).join(', ')}\n`;
    } else {
      report += `▲ Vercel: No deployments\n`;
    }

    if (render?.deploys?.length > 0) {
      report += `🚀 Render: ${render.deploys.map(d => `${d.service} (${d.status})`).join(', ')}\n`;
    } else {
      report += `🚀 Render: No deployments\n`;
    }

    report += `\nTotal: ${totalCommits} commits, ${totalDeploys} deploys`;

    await sendTelegramMessage(bot, report);

    // Only post to social if there's actual activity
    if (totalCommits > 0 || totalDeploys > 0) {
      const linkedInContent = formatForLinkedIn(data);
      const twitterContent = formatForTwitter(data);

      const linkedInSuccess = await postToLinkedIn(linkedInContent);
      await sendTelegramMessage(bot, linkedInSuccess ? '✅ Posted to LinkedIn' : '❌ LinkedIn post failed');

      const twitterSuccess = await postToTwitter(twitterContent);
      await sendTelegramMessage(bot, twitterSuccess ? '✅ Posted to Twitter/X' : '❌ Twitter post failed');
    } else {
      await sendTelegramMessage(bot, '💤 No activity — skipped social posting');
    }

  } catch (error) {
    console.error('Error in monitoring cycle:', error);
    await sendTelegramMessage(bot, `❌ Monitoring error: ${error.message}`);
  }
}