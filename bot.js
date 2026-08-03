import { Telegraf } from 'telegraf';
import { runMonitoringCycle } from './scheduler.js';
import { getGithubActivity } from './monitor/github.js';
import { getVercelDeployments } from './monitor/vercel.js';
import { getRenderDeploys } from './monitor/render.js';
import { formatForLinkedIn, formatForTwitter } from './formatter.js';
import { handleGeminiChat } from './gemini.js';

// New: routing + onchain research services
import config from './config.js';
import * as router from './router.js';
import * as coingecko from './services/coingecko.js';
import * as contractAnalyzer from './services/contractAnalyzer.js';
import * as venice from './services/venice.js';

let isPaused = false;

function isGroupAllowed(chatId) {
  if (!config.telegram.allowedChatIds.length) return true; // no allowlist = allow all
  return config.telegram.allowedChatIds.includes(String(chatId));
}

async function wasBotMentioned(ctx) {
  const me = ctx.botInfo;
  const msg = ctx.message;
  if (!msg || !msg.text) return false;

  const entities = msg.entities || [];
  const mentioned = entities.some((e) => {
    if (e.type !== 'mention') return false;
    const mentionText = msg.text.substring(e.offset, e.offset + e.length);
    return mentionText.toLowerCase() === `@${me.username}`.toLowerCase();
  });
  if (mentioned) return true;

  if (msg.reply_to_message && msg.reply_to_message.from?.id === me.id) return true;

  return false;
}

function stripMention(text, username) {
  return text.replace(new RegExp(`@${username}`, 'gi'), '').trim();
}

// Routes a question to price lookup / contract research / general Gemini
// chat. Returns nothing directly — sends replies via ctx itself, since
// contract research can send more than one message (structured summary +
// optional Venice explanation).
async function handleQuestion(ctx, rawText) {
  const text = stripMention(rawText, ctx.botInfo.username);
  const classification = router.classify(text);

  try {
    switch (classification.intent) {
      case 'price_lookup': {
        if (!classification.symbol) {
          return ctx.reply("Tell me which coin — e.g. 'what's the market cap of SOL'.");
        }
        ctx.sendChatAction('typing');
        const data = await coingecko.getMarketData(classification.symbol);
        return ctx.replyWithMarkdown(coingecko.formatMarketData(data));
      }

      case 'contract_research': {
        ctx.sendChatAction('typing');
        const analysis = await contractAnalyzer.analyzeContract(
          classification.address,
          classification.chainHint
        );

        if (!analysis.resolved) {
          return ctx.reply(analysis.note);
        }

        await ctx.replyWithMarkdown(contractAnalyzer.formatAnalysis(analysis));

        // Optional plain-English gloss via Venice (kimi-k3) — non-fatal if
        // VENICE_API_KEY isn't set or the call fails.
        if (config.venice.apiKey) {
          try {
            const explanation = await venice.explainContractAnalysis(analysis);
            if (explanation) await ctx.reply(explanation);
          } catch (e) {
            console.warn('Venice explanation failed:', e.message);
          }
        }
        return;
      }

      case 'contract_research_no_address': {
        return ctx.reply(
          "Send me the contract address (0x...) and optionally the chain (eth/bsc/polygon/arbitrum) and I'll check if it looks abandoned."
        );
      }

      case 'general_chat':
      default: {
        ctx.sendChatAction('typing');
        const response = await handleGeminiChat(text);
        return ctx.reply(response);
      }
    }
  } catch (err) {
    console.error('Error handling question:', err);
    return ctx.reply(
      "pulling that data — could be a free-tier API rate limit. Try again in a bit."
    );
  }
}

export function setupBot(token) {
  const bot = new Telegraf(token);
  bot.notificationChatId = process.env.TELEGRAM_CHAT_ID || null;

  const rememberChat = (ctx) => {
    const chatId = ctx?.chat?.id;
    if (chatId) {
      bot.notificationChatId = String(chatId);
    }
  };

  bot.start((ctx) => {
    rememberChat(ctx);
    ctx.reply(
      'Welcome to OpenClaw Agent! 🤖\n\n' +
        'Commands:\n/status - Check agent status\n/trigger - Run monitoring cycle now\n/preview - Preview next post\n/pause - Pause auto-posting\n/resume - Resume auto-posting\n\n' +
        "DM me anything, or add me to a group and @mention me with:\n" +
        "• price/market cap questions (e.g. \"what's the market cap of SOL\")\n" +
        '• a contract address (0x...) for abandoned/presale research\n' +
        '• any other web3 question'
    );
  });

  bot.command('status', (ctx) => {
    rememberChat(ctx);
    ctx.reply(`Agent is running.\nAuto-posting is ${isPaused ? 'PAUSED ⏸️' : 'ACTIVE ✅'}\nLast check: ${new Date().toLocaleString()}`);
  });

  bot.command('trigger', async (ctx) => {
    rememberChat(ctx);
    ctx.reply('Triggering monitoring cycle...');
    await runMonitoringCycle(bot);
    ctx.reply('Cycle complete.');
  });

  bot.command('preview', async (ctx) => {
    rememberChat(ctx);
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
    rememberChat(ctx);
    isPaused = true;
    ctx.reply('Auto-posting paused.');
  });

  bot.command('resume', (ctx) => {
    rememberChat(ctx);
    isPaused = false;
    ctx.reply('Auto-posting resumed.');
  });

  // Handle free text messages
  bot.on('text', async (ctx) => {
    rememberChat(ctx);
    // Ignore commands (starting with /)
    if (ctx.message.text.startsWith('/')) return;

    const chatType = ctx.chat.type;

    // DMs: respond to everything, same as before.
    if (chatType === 'private') {
      return handleQuestion(ctx, ctx.message.text);
    }

    // Groups/channels: only respond when @mentioned or replied to.
    if ((chatType === 'group' || chatType === 'supergroup') && isGroupAllowed(ctx.chat.id)) {
      const mentioned = await wasBotMentioned(ctx);
      if (mentioned) {
        return handleQuestion(ctx, ctx.message.text);
      }
      // Not mentioned in a group: stay silent, same as OpenClaw ignoring
      // unrelated group chatter.
    }
  });

  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}