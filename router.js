// router.js — lives at repo root
// Cheap keyword/regex classification, no extra LLM call needed just to
// decide what kind of question this is.

const EVM_ADDRESS_RE = /0x[a-fA-F0-9]{40}/;
const PRICE_KEYWORDS = /\b(price|market ?cap|mcap|worth|value|how much is)\b/i;
const RESEARCH_KEYWORDS = /\b(abandoned|dead|rug|presale|contract|scam|research|verify|verified|liquidity)\b/i;
const CHAIN_HINT_RE = /\b(ethereum|eth|bsc|bnb|binance|polygon|matic|arbitrum|arb)\b/i;

export function classify(text) {
  const hasAddress = EVM_ADDRESS_RE.test(text);
  const address = hasAddress ? text.match(EVM_ADDRESS_RE)[0] : null;
  const chainHint = (text.match(CHAIN_HINT_RE) || [])[0] || null;

  if (hasAddress) {
    return { intent: 'contract_research', address, chainHint };
  }

  if (RESEARCH_KEYWORDS.test(text) && !PRICE_KEYWORDS.test(text)) {
    return { intent: 'contract_research_no_address' };
  }

  if (PRICE_KEYWORDS.test(text)) {
    const cleaned = text
      .replace(PRICE_KEYWORDS, '')
      .replace(/[?.!,]/g, '')
      .replace(/\b(of|is|the|what|whats|what's)\b/gi, '')
      .trim();
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const symbol = tokens[tokens.length - 1] || null;
    return { intent: 'price_lookup', symbol };
  }

  return { intent: 'general_chat' };
} 