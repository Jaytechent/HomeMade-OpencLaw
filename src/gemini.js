import { GoogleGenAI, Type } from '@google/genai';
import { getGithubActivity } from './monitor/github.js';
import { getVercelDeployments } from './monitor/vercel.js';
import { getRenderDeploys } from './monitor/render.js';
import { webSearch } from './tools/search.js';

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
let ai;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
} else {
  console.warn('GEMINI_API_KEY is not set. Conversational features will be disabled.');
}

// Tool Definitions
const githubTool = {
  name: 'github_activity',
  description: "Fetches the user's recent GitHub events (commits, PRs, releases, stars, issues) from the last 24 hours.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const vercelTool = {
  name: 'vercel_deployments',
  description: "Fetches the user's recent Vercel deployments (READY, ERROR, BUILDING) from the last 24 hours.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const renderTool = {
  name: 'render_deploys',
  description: "Fetches the user's recent Render service deploys from the last 24 hours.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const searchTool = {
  name: 'web_search',
  description: 'Searches the web for a given query. Use this to find information, prices, documentation, or news.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
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
  if (!ai) {
    return 'I am currently offline (GEMINI_API_KEY missing). Please configure my brain.';
  }

  try {
    const model = 'gemini-2.5-flash-latest'; // Using the latest Flash model (fast & free tier friendly)

    // 1. Send message with tools
    const result = await ai.models.generateContent({
      model,
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

    const response = result.response;
    const functionCalls = response.functionCalls;

    // 2. If no function calls, return text
    if (!functionCalls || functionCalls.length === 0) {
      return response.text;
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

    // 4. Send function results back to model
    const finalResult = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
        {
          role: 'model',
          parts: response.candidates[0].content.parts,
        },
        {
          role: 'user',
          parts: functionResponses.map(resp => ({
            functionResponse: resp
          })),
        },
      ],
      config: {
        tools,
        systemInstruction,
      },
    });

    return finalResult.response.text;

  } catch (error) {
    console.error('Gemini error:', error);
    return `My brain hurts. Something went wrong: ${error.message}`;
  }
}
