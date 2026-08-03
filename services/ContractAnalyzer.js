// services/contractAnalyzer.js
// Combines on-chain explorer data + DexScreener liquidity data into a
// human-readable verdict on whether a contract looks like a dead/abandoned
// 2021 or 2017-era presale token.
//
// This is heuristic pattern-matching on public data, NOT proof of scam
// intent — the output says so explicitly, on purpose.

import * as explorer from './multichainExplorer.js';
import * as dex from './dexscreener.js';
import config from '../config.js';

const CHAIN_ALIASES = {
  eth: 'ethereum',
  ethereum: 'ethereum',
  bsc: 'bsc',
  bnb: 'bsc',
  binance: 'bsc',
  polygon: 'polygon',
  matic: 'polygon',
  arbitrum: 'arbitrum',
  arb: 'arbitrum',
};

function normalizeChain(chain) {
  const key = (chain || '').toLowerCase();
  return CHAIN_ALIASES[key] || null;
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

function yearsSince(ts) {
  if (!ts) return null;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24 * 365.25);
}

async function detectChainForAddress(address) {
  const chains = Object.keys(config.explorer.chains);
  for (const chain of chains) {
    try {
      const profile = await explorer.getContractCreation(chain, address);
      if (profile) return chain;
    } catch (_) {
      /* try next chain */
    }
  }
  return null;
}

export async function analyzeContract(address, chainHint) {
  let chain = normalizeChain(chainHint);
  if (!chain) chain = await detectChainForAddress(address);

  if (!chain) {
    return {
      address,
      resolved: false,
      note:
        'Could not find this contract on Ethereum, BSC, Polygon, or Arbitrum. ' +
        'Double check the address, or tell me which chain it is on.',
    };
  }

  const [profile, pairs] = await Promise.all([
    explorer.getContractProfile(chain, address),
    dex.getPairsForToken(address).catch(() => []),
  ]);

  const dexSummary = dex.summarizePairs(pairs);
  const createdAt = dexSummary.oldestPairCreatedAt;
  const lastActivityAt = profile.activity?.lastTxTimestamp || null;
  const ageYears = yearsSince(createdAt);
  const inactivityDays = daysSince(lastActivityAt);

  // A pool having existed at all (pairCount > 0) is the proof that this
  // contract *did* have liquidity at some point — you can't create a DEX
  // pair without depositing liquidity. That's what separates "this was a
  // live presale token and the liquidity is now gone" (real abandoned/rug
  // signal) from "this contract never launched a pool" (not a presale
  // case at all). Only the former gets scored as abandoned.
  const everHadLiquidity = dexSummary.pairCount > 0;

  if (!everHadLiquidity) {
    return {
      address,
      chain,
      resolved: true,
      verdict: 'No trading pool ever found — not a presale/liquidity case',
      abandonedScore: 0,
      ageYears: null,
      inactivityDays,
      liquidityUsd: 0,
      volume24hUsd: 0,
      pairCount: 0,
      verified: profile.verification?.verified ?? null,
      contractName: profile.verification?.contractName ?? null,
      creator: profile.creation?.creator ?? null,
      signals: [
        'No DEX trading pair was ever created for this address on any chain/DEX DexScreener indexes.',
        'This means it never had liquidity to begin with, so it cannot be scored as an "abandoned presale" — that label only applies to tokens that were actually traded at some point.',
        "If this is a non-token contract (e.g. a vault, multisig, or unlaunched project), that's expected. If a presale happened off-chain or on a DEX not covered here, tell me the chain/DEX and I can check further.",
      ],
    };
  }

  const signals = [];
  let abandonedScore = 0;

  if (ageYears != null && ageYears >= config.abandonedThresholds.minAgeYearsToConsider) {
    signals.push(`Pair first created ~${ageYears.toFixed(1)} years ago.`);
  }

  if (dexSummary.totalLiquidityUsd <= config.abandonedThresholds.maxLiquidityUsd) {
    abandonedScore += 2;
    signals.push(
      `Had a live pool (confirming liquidity existed at launch), but liquidity is now effectively gone ($${dexSummary.totalLiquidityUsd.toFixed(2)} remaining) — this is the strongest signal of abandonment or a rug.`
    );
  }

  if (dexSummary.totalVolume24hUsd === 0) {
    abandonedScore += 1;
    signals.push('Zero trading volume in the last 24h.');
  }

  if (inactivityDays != null && inactivityDays >= config.abandonedThresholds.minDaysSinceLastActivity) {
    abandonedScore += 2;
    signals.push(`No on-chain transaction activity in ${inactivityDays} days.`);
  } else if (inactivityDays == null) {
    signals.push('No transaction history found for this address at all.');
  }

  if (profile.verification && profile.verification.verified === false) {
    abandonedScore += 1;
    signals.push('Contract source code is not verified on the block explorer (common in low-effort presale launches).');
  }

  let verdict;
  if (abandonedScore >= 4) verdict = 'Likely abandoned';
  else if (abandonedScore >= 2) verdict = 'Possibly abandoned / dormant';
  else verdict = 'Appears active, not conclusively abandoned';

  return {
    address,
    chain,
    resolved: true,
    verdict,
    abandonedScore,
    ageYears,
    inactivityDays,
    liquidityUsd: dexSummary.totalLiquidityUsd,
    volume24hUsd: dexSummary.totalVolume24hUsd,
    pairCount: dexSummary.pairCount,
    verified: profile.verification?.verified ?? null,
    contractName: profile.verification?.contractName ?? null,
    creator: profile.creation?.creator ?? null,
    signals,
  };
}

export function formatAnalysis(a) {
  if (!a.resolved) return a.note;

  const fmt = (n) => (n == null ? 'n/a' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n));

  const lines = [
    `*Contract Analysis* — \`${a.address}\` on ${a.chain}`,
    a.contractName ? `Name: ${a.contractName}` : null,
    `Verdict: *${a.verdict}* (heuristic score: ${a.abandonedScore}/6)`,
    a.ageYears != null ? `Approx. age: ${a.ageYears.toFixed(1)} years` : null,
    `Liquidity: $${fmt(a.liquidityUsd)} across ${a.pairCount} pair(s)`,
    `24h volume: $${fmt(a.volume24hUsd)}`,
    a.inactivityDays != null ? `Last on-chain activity: ${a.inactivityDays} days ago` : 'Last on-chain activity: unknown',
    a.verified != null ? `Source verified: ${a.verified ? 'yes' : 'no'}` : null,
    '',
    'Signals:',
    ...a.signals.map((s) => `• ${s}`),
    '',
    '_This is heuristic pattern-matching on public data, not financial or legal advice — it cannot prove scam intent, only that the contract looks dormant._',
  ].filter(Boolean);

  return lines.join('\n');
}