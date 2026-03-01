import axios from 'axios';

export async function webSearch(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.error('SERPER_API_KEY is not set');
    return 'Error: Search API key not configured.';
  }

  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      { q: query },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const results = response.data.organic || [];
    if (results.length === 0) return 'No results found.';

    return results
      .slice(0, 5)
      .map((r) => `- [${r.title}](${r.link}): ${r.snippet}`)
      .join('\n');
  } catch (error) {
    console.error('Search error:', error.message);
    return `Error performing search: ${error.message}`;
  }
}
