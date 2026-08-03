// services/dexscreener.js
import axios from 'axios';
import config from '../config.js';

const client = axios.create({ baseURL: config.dexscreener.baseUrl, timeout: 15000 });

export async function getPairsForToken(address) {
  const { data } = await client.get(`/latest/dex/tokens/${address}`);
  return data.pairs || [];
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