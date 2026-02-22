import { TwitterApi } from 'twitter-api-v2';

export async function postToTwitter(content) {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    console.error('Twitter API keys are not fully set');
    return false;
  }

  try {
    const client = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });

    const rwClient = client.readWrite;

    await rwClient.v2.tweet(content);
    console.log('Successfully posted to Twitter');
    return true;
  } catch (error) {
    console.error('Error posting to Twitter:', error);
    return false;
  }
}
