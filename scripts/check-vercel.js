fetch('https://api.vercel.com/v6/deployments?projectId=prj_7tPZzPHA9rpGnu9fZp4rFO1vCRUL&teamId=team_r33L67KzzgWuArp1r27PpMAi&limit=10', {
  headers: { Authorization: 'Bearer vcp_0gFzsK7W' }
})
.then(async r => {
  console.log('Status:', r.status);
  const d = await r.json();
  if (d.deployments) {
    d.deployments.forEach(x => {
      console.log(x.createdAt, '|', x.state, '|', x.target || 'production', '|', x.url, '|', x.meta?.githubCommitMessage || '');
    });
  } else {
    console.log(JSON.stringify(d).slice(0, 500));
  }
});
