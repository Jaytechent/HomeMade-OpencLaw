// services/multichainExplorer.js
import axios from 'axios';
import config from '../config.js';

const client = axios.create({ baseURL: config.explorer.baseUrl, timeout: 15000 });

async function call(chainName, params) {
  const chainid = config.explorer.chains[chainName];
  if (!chainid) throw new Error(`Unsupported chain: ${chainName}`);
  if (!config.explorer.apiKey) {
    throw new Error('ETHERSCAN_API_KEY is not set. Get a free key at https://etherscan.io/apis');
  }
  const { data } = await client.get('', { params: { chainid, apikey: config.explorer.apiKey, ...params } });
  return data;
}

export async function getContractCreation(chainName, address) {
  const data = await call(chainName, {
    module: 'contract',
    action: 'getcontractcreation',
    contractaddresses: address,
  });
  const row = data.result?.[0];
  if (!row) return null;
  return { creator: row.contractCreator, txHash: row.txHash };
}

export async function getSourceVerification(chainName, address) {
  const data = await call(chainName, { module: 'contract', action: 'getsourcecode', address });
  const row = data.result?.[0];
  if (!row) return { verified: false };
  return {
    verified: Boolean(row.SourceCode && row.SourceCode.length > 0),
    contractName: row.ContractName || null,
    proxy: row.Proxy === '1',
  };
}

export async function getLastActivity(chainName, address) {
  const data = await call(chainName, {
    module: 'account',
    action: 'txlist',
    address,
    startblock: 0,
    endblock: 99999999,
    page: 1,
    offset: 1,
    sort: 'desc',
  });
  const row = data.result?.[0];
  if (!row) return null;
  return { lastTxTimestamp: Number(row.timeStamp) * 1000, lastTxHash: row.hash };
}

export async function getContractProfile(chainName, address) {
  const [creation, verification, activity] = await Promise.all([
    getContractCreation(chainName, address).catch(() => null),
    getSourceVerification(chainName, address).catch(() => ({ verified: false })),
    getLastActivity(chainName, address).catch(() => null),
  ]);
  return { chain: chainName, address, creation, verification, activity };
}