// services/coingecko.js
import axios from 'axios';
import config from '../config.js';

const client = axios.create({ baseURL: config.coingecko.baseUrl, timeout: 10000 });

const COMMON_SYMBOLS = {
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  bnb: 'binancecoin',
  matic: 'matic-network',
  pol: 'polygon-ecosystem-token',
  arb: 'arbitrum',
  usdt: 'tether',
  usdc: 'usd-coin',
  doge: 'dogecoin',
  xrp: 'ripple',
  ada: 'cardano',
  avax: 'avalanche-2',
  link: 'chainlink',
  op: 'optimism',
  ton: 'the-open-network',
};

export async function resolveCoinId(symbolOrName) {
  const key = symbolOrName.trim().toLowerCase().replace(/^\$/, '');
  if (COMMON_SYMBOLS[key]) return COMMON_SYMBOLS[key];

  const { data } = await client.get('/search', { params: { query: key } });
  const coins = data.coins || [];
  if (!coins.length) return null;

  const exactSymbol = coins.find((c) => c.symbol.toLowerCase() === key);
  const exactName = coins.find((c) => c.name.toLowerCase() === key);
  return (exactSymbol || exactName || coins[0]).id;
}

export async function getMarketData(symbolOrName) {
  const id = await resolveCoinId(symbolOrName);
  if (!id) return { found: false, query: symbolOrName };

  const { data } = await client.get(`/coins/${id}`, {
    params: {
      localization: false,
      tickers: false,
      community_data: false,
      developer_data: false,
      sparkline: false,
    },
  });

  const m = data.market_data;
  return {
    found: true,
    id,
    name: data.name,
    symbol: data.symbol.toUpperCase(),
    priceUsd: m.current_price.usd,
    marketCapUsd: m.market_cap.usd,
    marketCapRank: data.market_cap_rank,
    change24hPct: m.price_change_percentage_24h,
    volume24hUsd: m.total_volume.usd,
    circulatingSupply: m.circulating_supply,
  };
}

export function formatMarketData(d) {
  if (!d.found) {
    return `I couldn't find a coin matching "${d.query}" on CoinGecko.`;
  }
  const fmt = (n) =>
    n == null ? 'n/a' : new Intl.NumberFormat('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 }).format(n);
  const arrow = d.change24hPct >= 0 ? '🟢' : '🔴';

  return (
    `*${d.name} (${d.symbol})* — Rank #${d.marketCapRank ?? 'n/a'}\n` +
    `Price: $${fmt(d.priceUsd)}\n` +
    `Market Cap: $${fmt(d.marketCapUsd)}\n` +
    `24h: ${arrow} ${d.change24hPct?.toFixed(2) ?? 'n/a'}%\n` +
    `24h Volume: $${fmt(d.volume24hUsd)}\n` +
    `Circulating Supply: ${fmt(d.circulatingSupply)} ${d.symbol}`
  );
}