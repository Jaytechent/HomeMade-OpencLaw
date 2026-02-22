import axios from 'axios';
import dayjs from 'dayjs';

export async function getGithubActivity() {
  const username = process.env.GITHUB_USERNAME;
  const token = process.env.GITHUB_TOKEN;

  if (!username) {
    console.error('GITHUB_USERNAME is not set');
    return null;
  }

  try {
    const response = await axios.get(`https://api.github.com/users/${username}/events`, {
      headers: {
        Authorization: token ? `token ${token}` : undefined,
        Accept: 'application/vnd.github.v3+json',
      },
      params: {
        per_page: 100, // Get max events per page
      },
    });

    const events = response.data;
    const yesterday = dayjs().subtract(24, 'hour');

    const recentEvents = events.filter((event) => dayjs(event.created_at).isAfter(yesterday));

    const activity = {
      commits: 0,
      prs: 0,
      releases: 0,
      stars: 0,
      issues: 0,
      repoNames: new Set(),
    };

    recentEvents.forEach((event) => {
      activity.repoNames.add(event.repo.name);

      switch (event.type) {
        case 'PushEvent':
          activity.commits += event.payload.commits ? event.payload.commits.length : 0;
          break;
        case 'PullRequestEvent':
          if (event.payload.action === 'opened') {
            activity.prs += 1;
          }
          break;
        case 'ReleaseEvent':
          if (event.payload.action === 'published') {
            activity.releases += 1;
          }
          break;
        case 'WatchEvent': // Star event
          if (event.payload.action === 'started') {
            activity.stars += 1;
          }
          break;
        case 'IssuesEvent':
          if (event.payload.action === 'opened') {
            activity.issues += 1;
          }
          break;
      }
    });

    return {
      ...activity,
      repoNames: Array.from(activity.repoNames),
    };
  } catch (error) {
    console.error('Error fetching GitHub activity:', error.message);
    return null;
  }
}
