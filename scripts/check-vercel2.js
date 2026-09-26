fetch('https://api.vercel.com/v6/deployments?projectId=prj_eUxwQ2EiRpv9srmYPCMaA7XlRKBE&teamId=team_uPhdzVBLnxFgz6qJi435AK1g&limit=5', {
  headers: { Authorization: 'Bearer vcp_0gFzsK7W' }
})
.then(async r => {
  console.log('Status:', r.status);
  const d = await r.json();
  if (d.deployments) {
    d.deployments.forEach(x => {
      console.log(x.createdAt, '|', x.state, '|', x.target || 'production', '|', x.url, '|', x.meta?.githubCommitMessage || x.meta?.commitMessage || '');
    });
  } else {
    console.log(JSON.stringify(d, null, 2).slice(0, 800));
  }
});
