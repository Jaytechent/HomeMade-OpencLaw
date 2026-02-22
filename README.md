# OpenClaw Agent 🤖

A complete autonomous agent deployed as a Telegram bot on Render free tier.
Monitors GitHub, Vercel, and Render accounts for activity, summarizes it, and posts to LinkedIn and Twitter/X.

## Setup

1.  **Clone the repository**
2.  **Install dependencies**: `npm install`
3.  **Configure Environment Variables**:
    Copy `.env.example` to `.env` and fill in the values.

    -   `PORT`: 3000 (default)
    -   `TELEGRAM_BOT_TOKEN`: Get from @BotFather on Telegram.
    -   `TELEGRAM_CHAT_ID`: Your Telegram User ID (get from @userinfobot).
    -   `GITHUB_TOKEN`: Personal Access Token (classic) with `repo` scope.
    -   `GITHUB_USERNAME`: Your GitHub username.
    -   `VERCEL_TOKEN`: Create at vercel.com/account/tokens.
    -   `RENDER_API_KEY`: Create at dashboard.render.com/account.
    -   `LINKEDIN_ACCESS_TOKEN`: OAuth 2.0 Access Token.
    -   `LINKEDIN_PERSON_URN`: Your LinkedIn Person URN (e.g., `urn:li:person:12345`).
    -   `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`: From developer.twitter.com.
    -   `RENDER_URL`: The URL of your deployed Render app (e.g., `https://your-app.onrender.com`).

4.  **Run Locally**: `npm run dev`
5.  **Deploy to Render**:
    -   Connect your repo to Render.
    -   Select "Web Service".
    -   Runtime: Node
    -   Build Command: `npm install`
    -   Start Command: `npm start`
    -   Add Environment Variables from `.env`.

## Features

-   **Autonomous Monitoring**: Checks GitHub, Vercel, and Render every day at 8 AM and 6 PM UTC.
-   **Smart Formatting**: Generates engaging "dev diary" style posts.
-   **Multi-Platform Posting**: Posts to LinkedIn and Twitter/X.
-   **Gemini AI Assistant**:
    -   Chat with the bot to ask questions, draft content, or research topics.
    -   Powered by Google Gemini 3.0 Pro Preview.
    -   Tools: Web Search, GitHub Activity, Vercel/Render Status.
-   **Telegram Control**:
    -   `/status`: Check agent status.
    -   `/trigger`: Manually run the monitoring cycle.
    -   `/preview`: See what the post would look like.
    -   `/pause` / `/resume`: Control auto-posting.
-   **Free Tier Optimized**: Self-pings every 14 minutes to prevent sleeping on Render.

## Project Structure

-   `src/index.js`: Entry point, Express server.
-   `src/bot.js`: Telegram bot logic.
-   `src/scheduler.js`: Cron jobs.
-   `src/monitor/`: Data fetchers.
-   `src/poster/`: Social media posters.
-   `src/formatter.js`: Content generation.
