// services/venice.js
// Venice AI client (model: kimi-k3), used specifically to turn structured
// on-chain research data into a plain-English explanation.
// Docs: https://docs.venice.ai/overview/about

import axios from 'axios';
import config from '../config.js';

const client = axios.create({
  baseURL: config.venice.baseUrl,
  timeout: 30000,
  headers: { Authorization: `Bearer ${config.venice.apiKey}`, 'Content-Type': 'application/json' },
});

export async function chat(messages, opts = {}) {
  if (!config.venice.apiKey) throw new Error('VENICE_API_KEY is not set.');

  const { data } = await client.post('/chat/completions', {
    model: config.venice.model,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 700,
  });

  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function explainContractAnalysis(analysis) {
  const system =
    'You are an on-chain research assistant. You are given structured, ' +
    'already-computed data about a smart contract (liquidity, age, activity, ' +
    'verification status). Write a short, clear explanation (max 120 words) ' +
    'of what this means for a Telegram group audience. Do not invent data ' +
    'that was not given to you. Be direct about uncertainty — this is ' +
    'heuristic pattern-matching, not proof of fraud.';

  const userMsg = `Structured analysis:\n${JSON.stringify(analysis, null, 2)}`;

  return chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ],
    { maxTokens: 300 }
  );
}