import axios from 'axios';
import dayjs from 'dayjs';

export async function getRenderDeploys() {
  const apiKey = process.env.RENDER_API_KEY;

  if (!apiKey) {
    console.error('RENDER_API_KEY is not set');
    return null;
  }

  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };

    // 1. Fetch all services
    const servicesResponse = await axios.get('https://api.render.com/v1/services', {
      headers,
      params: { limit: 100 },
    });

    const services = servicesResponse.data;
    const yesterday = dayjs().subtract(24, 'hour');
    const recentDeploys = [];

    // 2. For each service, fetch recent deploys
    // Note: This might hit rate limits if you have MANY services.
    // Render API rate limit is generous enough for a personal account usually.
    for (const service of services) {
      try {
        const deploysResponse = await axios.get(
          `https://api.render.com/v1/services/${service.service.id}/deploys`,
          {
            headers,
            params: { limit: 20 }, // Fetch last 20 deploys per service
          }
        );

        const deploys = deploysResponse.data;

        const newDeploys = deploys.filter((deploy) =>
          dayjs(deploy.deploy.createdAt).isAfter(yesterday)
        );

        newDeploys.forEach((deploy) => {
          recentDeploys.push({
            service: service.service.name,
            status: deploy.deploy.status, // live, build_failed, canceled, etc.
            createdAt: deploy.deploy.createdAt,
          });
        });
      } catch (err) {
        console.error(`Error fetching deploys for service ${service.service.name}:`, err.message);
      }
    }

    return {
      deploys: recentDeploys,
    };
  } catch (error) {
    console.error('Error fetching Render services:', error.message);
    return null;
  }
}
