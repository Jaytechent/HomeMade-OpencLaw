import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { getGithubActivity } from './monitor/github.js';
import { getVercelDeployments } from './monitor/vercel.js';
import { getRenderDeploys } from './monitor/render.js';
import { webSearch } from './tools/search.js';

dotenv.config();

const MODEL_NAME = 'gemini-3-flash-preview';

let ai;
let configuredApiKey;

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ GOOGLE_API_KEY not set. Gemini features are offline.');
    return null;
  }

  if (!ai || configuredApiKey !== apiKey) {
    ai = new GoogleGenAI({ apiKey });
    configuredApiKey = apiKey;
  }

  return ai;
}

// Tool Definitions — use parametersJsonSchema (not parameters) for new SDK
const githubTool = {
  name: 'github_activity',
  description: "Fetches the user's recent GitHub events (commits, PRs, releases, stars, issues) from the last 24 hours.",
  parametersJsonSchema: {
    type: 'object',
    properties: {},
  },
};

const vercelTool = {
  name: 'vercel_deployments',
  description: "Fetches the user's recent Vercel deployments (READY, ERROR, BUILDING) from the last 24 hours.",
  parametersJsonSchema: {
    type: 'object',
    properties: {},
  },
};

const renderTool = {
  name: 'render_deploys',
  description: "Fetches the user's recent Render service deploys from the last 24 hours.",
  parametersJsonSchema: {
    type: 'object',
    properties: {},
  },
};

const searchTool = {
  name: 'web_search',
  description: 'Searches the web for a given query. Use this to find information, prices, documentation, or news.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query.',
      },
    },
    required: ['query'],
  },
};

const tools = [
  { functionDeclarations: [githubTool, vercelTool, renderTool, searchTool] },
];

const systemInstruction = `You are OpenClaw, a personal dev assistant agent.
You help the user monitor their dev infrastructure, research prices, compare services, draft social content, and answer questions.
Always be concise since you reply via Telegram.
Use the available tools to fetch real-time data when needed.
If you need to search the web, use the web_search tool.
If you need to check dev activity, use the appropriate monitor tools.`;

export async function handleGeminiChat(userMessage) {
  const geminiClient = getGeminiClient();
  if (!geminiClient) {
    return 'I am currently offline (GOOGLE_API_KEY missing). Please configure my brain.';
  }

  try {
    // 1. Send message with tools
    // NOTE: In the new @google/genai SDK, generateContent returns the response DIRECTLY
    // (not nested under .response). functionCalls is on the top-level result object.
    const result = await geminiClient.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      config: {
        tools,
        systemInstruction,
      },
    });

    // 2. If no function calls, return text
    const functionCalls = result.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      return result.text;
    }

    // 3. Handle function calls
    const functionResponses = [];

    for (const call of functionCalls) {
      let functionResult;
      const { name, args } = call;

      try {
        if (name === 'github_activity') {
          functionResult = await getGithubActivity();
        } else if (name === 'vercel_deployments') {
          functionResult = await getVercelDeployments();
        } else if (name === 'render_deploys') {
          functionResult = await getRenderDeploys();
        } else if (name === 'web_search') {
          functionResult = await webSearch(args.query);
        } else {
          functionResult = { error: `Unknown function ${name}` };
        }
      } catch (error) {
        functionResult = { error: error.message };
      }

      functionResponses.push({
        name,
        response: { result: functionResult },
      });
    }

    const finalResult = await geminiClient.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
        {
          role: 'model',
          parts: result.candidates[0].content.parts,
        },
        {
          role: 'user',
          parts: functionResponses.map((resp) => ({
            functionResponse: resp,
          })),
        },
      ],
      config: {
        tools,
        systemInstruction,
      },
    });

    return finalResult.text;
  } catch (error) {
    console.error('Gemini error:', error);
    return `My brain hurts. Something went wrong: ${error.message}`;
  }
}