// config.js — lives at repo root, alongside bot.js/gemini.js/index.js
// ES module, matching this repo's "type": "module" setup.

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    // Optional: comma-separated chat IDs to restrict which groups the
    // new agent behavior answers in. Leave unset to allow any group.
    allowedChatIds: (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // NOTE: your existing gemini.js reads process.env.GOOGLE_API_KEY, not
  // GEMINI_API_KEY — your .env.example currently lists the wrong name.
  // Not changed here since gemini.js already works this way; just flagging.

  venice: {
    apiKey: process.env.VENICE_API_KEY,
    baseUrl: process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1',
    model: process.env.VENICE_MODEL || 'kimi-k3',
  },

  // Etherscan V2 unified API: one free key covers Ethereum, BSC, Polygon,
  // and Arbitrum — you just pass a different chainid per request.
  explorer: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    baseUrl: 'https://api.etherscan.io/v2/api',
    chains: {
      ethereum: 1,
      bsc: 56,
      polygon: 137,
      arbitrum: 42161,
    },
  },

  // No API key required for DexScreener's public API.
  dexscreener: {
    baseUrl: 'https://api.dexscreener.com',
  },

  // No API key required for CoinGecko's public endpoints (rate-limited).
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
  },

  abandonedThresholds: {
    minDaysSinceLastActivity: 180,
    maxLiquidityUsd: 250,
    minAgeYearsToConsider: 2,
  },
};

export default config;