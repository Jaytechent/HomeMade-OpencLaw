import dayjs from 'dayjs';

export function formatForLinkedIn(data) {
  const { github, vercel, render } = data;

  const totalCommits = github?.commits || 0;
  const totalDeploys = (vercel?.deployments?.length || 0) + (render?.deploys?.length || 0);
  const totalServices = (render?.deploys?.length || 0) + (vercel?.deployments?.length || 0);

  let content = `🚀 Builder's Daily Log | ${dayjs().format('MMM D, YYYY')}\n\n`;

  content += `What shipped today:\n`;
  if (totalCommits > 0) {
    content += `⚡ ${totalCommits} commits pushed across ${github.repoNames.join(', ')}\n`;
  }
  if (vercel?.deployments?.length > 0) {
    const projects = vercel.deployments.map((d) => d.project).join(', ');
    content += `🟢 ${vercel.deployments.length} Vercel deploys went live — ${projects}\n`;
  }
  if (render?.deploys?.length > 0) {
    const services = render.deploys.map((d) => d.service).join(', ');
    content += `🔧 ${render.deploys.length} Render services updated — ${services}\n`;
  }

  if (totalCommits === 0 && totalDeploys === 0) {
    content += `No major updates today, but the grind continues behind the scenes. 🛠️\n`;
  }

  content += `\nBiggest win: Kept the momentum going. Consistency is key.\n\n`;
  content += `Building in public. Every deploy counts. 🏗️\n\n`;
  content += `#buildinpublic #webdev #opensource #coding #developer`;

  return content;
}

export function formatForTwitter(data) {
  const { github, vercel, render } = data;

  const totalCommits = github?.commits || 0;
  const totalDeploys = (vercel?.deployments?.length || 0) + (render?.deploys?.length || 0);
  const totalServices = (render?.deploys?.length || 0) + (vercel?.deployments?.length || 0);

  let content = `🔨 Daily build log:\n`;
  content += `[${totalCommits}] commits | [${totalDeploys}] deploys | [${totalServices}] services updated\n`;

  if (totalCommits > 0) {
    content += `Main highlight: Pushed code to ${github.repoNames[0] || 'repos'}\n`;
  } else if (totalDeploys > 0) {
    content += `Main highlight: Deployed updates to production\n`;
  } else {
    content += `Main highlight: Planning and refactoring day\n`;
  }

  content += `Shipping daily 🚀 #buildinpublic`;

  return content;
}
