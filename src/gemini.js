import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk'; // ← native Groq SDK (not openai)
import { getGithubActivity } from './monitor/github.js';
import { getVercelDeployments } from './monitor/vercel.js';
import { getRenderDeploys } from './monitor/render.js';
import { webSearch } from './tools/search.js';

dotenv.config();

const GEMINI_MODEL = 'gemini-2.0-flash';
const GROQ_MODEL = 'openai/gpt-oss-20b'; // current recommended model per Groq docs

// ──────────────────────────────────────────
// Gemini Client
// ──────────────────────────────────────────
let ai;
let configuredApiKey;

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GOOGLE_API_KEY not set. Gemini is offline.');
    return null;
  }
  if (!ai || configuredApiKey !== apiKey) {
    ai = new GoogleGenAI({ apiKey });
    configuredApiKey = apiKey;
  }
  return ai;
}

// ──────────────────────────────────────────
// Groq Client (native groq-sdk)
// ──────────────────────────────────────────
let groqClient;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GROQ_API_KEY not set. Groq fallback is offline.');
    return null;
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// ──────────────────────────────────────────
// Tool Definitions (Gemini format)
// ──────────────────────────────────────────
const githubTool = {
  name: 'github_activity',
  description: "Fetches the user's recent GitHub events (commits, PRs, releases, stars, issues) from the last 24 hours.",
  parametersJsonSchema: { type: 'object', properties: {} },
};

const vercelTool = {
  name: 'vercel_deployments',
  description: "Fetches the user's recent Vercel deployments (READY, ERROR, BUILDING) from the last 24 hours.",
  parametersJsonSchema: { type: 'object', properties: {} },
};

const renderTool = {
  name: 'render_deploys',
  description: "Fetches the user's recent Render service deploys from the last 24 hours.",
  parametersJsonSchema: { type: 'object', properties: {} },
};

const searchTool = {
  name: 'web_search',
  description: 'Searches the web for a given query.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query.' },
    },
    required: ['query'],
  },
};

const geminiTools = [
  { functionDeclarations: [githubTool, vercelTool, renderTool, searchTool] },
];

// Tool Definitions (Groq format)
const groqTools = [
  {
    type: 'function',
    function: {
      name: 'github_activity',
      description: githubTool.description,
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'vercel_deployments',
      description: vercelTool.description,
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'render_deploys',
      description: renderTool.description,
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: searchTool.description,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query.' },
        },
        required: ['query'],
      },
    },
  },
];

const systemInstruction = `You are OpenClaw, a personal dev assistant agent.
You help the user monitor their dev infrastructure, research prices, compare services, draft social content, and answer questions.
Always be concise since you reply via Telegram.
Use the available tools to fetch real-time data when needed.`;

// ──────────────────────────────────────────
// Shared tool executor
// ──────────────────────────────────────────
async function executeTool(name, args = {}) {
  if (name === 'github_activity') return await getGithubActivity();
  if (name === 'vercel_deployments') return await getVercelDeployments();
  if (name === 'render_deploys') return await getRenderDeploys();
  if (name === 'web_search') return await webSearch(args.query);
  return { error: `Unknown function: ${name}` };
}

// ──────────────────────────────────────────
// Groq fallback handler
// ──────────────────────────────────────────
async function handleGroqFallback(userMessage) {
  const groq = getGroqClient();
  if (!groq) {
    return '⚠️ Both Gemini and Groq are unavailable. Please check your API keys.';
  }

  console.log(`🔄 Falling back to Groq (${GROQ_MODEL})...`);

  try {
    const messages = [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userMessage },
    ];

    // 1. First call with tools
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      tools: groqTools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    const toolCalls = choice.message.tool_calls;

    // 2. No tool calls — return text directly
    if (!toolCalls || toolCalls.length === 0) {
      return `[via Groq]\n${choice.message.content}`;
    }

    // 3. Execute tools
    messages.push(choice.message);

    for (const toolCall of toolCalls) {
      let result;
      try {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        result = await executeTool(toolCall.function.name, args);
      } catch (err) {
        result = { error: err.message };
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // 4. Second call with tool results
    // Must pass tools + tool_choice:'auto' here too, otherwise Groq
    // defaults to tool_choice:'none' which causes a 400 if the model
    // still wants to call a tool after seeing the results.
    const finalResponse = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      tools: groqTools,
      tool_choice: 'auto',
    });

    return `[via Groq]\n${finalResponse.choices[0].message.content}`;
  } catch (error) {
    console.error('Groq error:', error);
    return `⚠️ Both Gemini and Groq failed: ${error.message}`;
  }
}

// ──────────────────────────────────────────
// Main Gemini handler (with Groq fallback)
// ──────────────────────────────────────────
export async function handleGeminiChat(userMessage) {
  const geminiClient = getGeminiClient();
  if (!geminiClient) {
    return handleGroqFallback(userMessage);
  }

  try {
    // 1. First Gemini call
    const result = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: { tools: geminiTools, systemInstruction },
    });

    const functionCalls = result.functionCalls;

    // 2. No tool calls — return text
    if (!functionCalls || functionCalls.length === 0) {
      return result.text;
    }

    // 3. Execute tools
    const functionResponses = [];
    for (const call of functionCalls) {
      let functionResult;
      try {
        functionResult = await executeTool(call.name, call.args);
      } catch (error) {
        functionResult = { error: error.message };
      }
      functionResponses.push({
        name: call.name,
        response: { result: functionResult },
      });
    }

    // 4. Second Gemini call with tool results
    const finalResult = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: 'user', parts: [{ text: userMessage }] },
        { role: 'model', parts: result.candidates[0].content.parts },
        {
          role: 'user',
          parts: functionResponses.map((resp) => ({ functionResponse: resp })),
        },
      ],
      config: { tools: geminiTools, systemInstruction },
    });

    return finalResult.text;

  } catch (error) {
    // ── Fallback to Groq on rate limit or quota error ──
    const isRateLimit =
      error.status === 429 ||
      error.code === 429 ||
      (error.message && error.message.includes('429')) ||
      (error.message && error.message.toLowerCase().includes('quota'));

    if (isRateLimit) {
      console.warn('⚠️  Gemini rate limited (429). Switching to Groq...');
      return handleGroqFallback(userMessage);
    }

    console.error('Gemini error:', error);
    return `My brain hurts. Something went wrong: ${error.message}`;
  }
}