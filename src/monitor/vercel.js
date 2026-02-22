import axios from 'axios';
import dayjs from 'dayjs';

export async function getVercelDeployments() {
  const token = process.env.VERCEL_TOKEN;

  if (!token) {
    console.error('VERCEL_TOKEN is not set');
    return null;
  }

  try {
    // Fetch deployments from Vercel API
    // Filter by state: READY, ERROR, BUILDING (though we mostly care about finished ones for the report)
    // We can filter by 'created' time in the API or client-side.
    // API supports 'since' parameter.
    const yesterdayTimestamp = dayjs().subtract(24, 'hour').valueOf();

    const response = await axios.get('https://api.vercel.com/v6/deployments', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        since: yesterdayTimestamp,
        limit: 100,
      },
    });

    const deployments = response.data.deployments;

    const relevantDeployments = deployments.filter((deploy) =>
      ['READY', 'ERROR', 'BUILDING'].includes(deploy.state)
    );

    return {
      deployments: relevantDeployments.map((deploy) => ({
        project: deploy.name,
        status: deploy.state,
        url: deploy.url ? `https://${deploy.url}` : null,
        duration: deploy.buildingAt && deploy.readyAt ? (deploy.readyAt - deploy.buildingAt) / 1000 : null, // duration in seconds
        createdAt: deploy.created,
      })),
    };
  } catch (error) {
    console.error('Error fetching Vercel deployments:', error.message);
    return null;
  }
}
