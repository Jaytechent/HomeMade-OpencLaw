// services/dexscreener.js
import axios from 'axios';
import config from '../config.js';

const client = axios.create({ baseURL: config.dexscreener.baseUrl, timeout: 15000 });

export async function getPairsForToken(address) {
  const { data } = await client.get(`/latest/dex/tokens/${address}`);
  return data.pairs || [];
}

export async function searchPairs(query) {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return [];

  const { data } = await client.get('/latest/dex/search', { params: { q: normalizedQuery } });
  return data.pairs || [];
}

export function resolveTokenFromPairs(pairs, query, chainHint) {
  const normalizedQuery = String(query || '').toLowerCase().replace(/^\$/, '').trim();
  const normalizedChain = String(chainHint || '').toLowerCase().trim();

  const scored = pairs
    .map((pair) => {
      const base = pair.baseToken || {};
      const quote = pair.quoteToken || {};
      const candidates = [base, quote].filter((token) => token.address);

      return candidates.map((token) => {
        const symbol = String(token.symbol || '').toLowerCase();
        const name = String(token.name || '').toLowerCase();
        let score = Number(pair.liquidity?.usd || 0) / 1000000;

        if (symbol === normalizedQuery) score += 10;
        if (name === normalizedQuery) score += 8;
        if (symbol.includes(normalizedQuery)) score += 4;
        if (name.includes(normalizedQuery)) score += 3;
        if (normalizedChain && String(pair.chainId || '').toLowerCase().includes(normalizedChain)) score += 2;

        return { pair, token, score };
      });
    })
    .flat()
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;

  return {
    address: best.token.address,
    chainId: best.pair.chainId || null,
    dexId: best.pair.dexId || null,
    name: best.token.name || null,
    symbol: best.token.symbol || null,
    pairAddress: best.pair.pairAddress || null,
    liquidityUsd: best.pair.liquidity?.usd || 0,
  };
}

export function summarizePairs(pairs) {
  if (!pairs.length) {
    return { hasLiquidity: false, totalLiquidityUsd: 0, totalVolume24hUsd: 0, oldestPairCreatedAt: null, pairCount: 0 };
  }
  const totalLiquidityUsd = pairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
  const totalVolume24hUsd = pairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
  const createdTimestamps = pairs.map((p) => p.pairCreatedAt).filter(Boolean);
  const oldestPairCreatedAt = createdTimestamps.length ? Math.min(...createdTimestamps) : null;

  return {
    hasLiquidity: totalLiquidityUsd > 0,
    totalLiquidityUsd,
    totalVolume24hUsd,
    oldestPairCreatedAt,
    pairCount: pairs.length,
  };
}