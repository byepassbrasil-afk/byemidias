// Testa via login direto
const PocketBase = require('pocketbase/cjs').default || require('pocketbase/cjs');
const pb = new PocketBase('http://servermidias-pocketbase-a0db05-2-25-238-133.sslip.io');
pb.autoCancellation(false);

(async () => {
  // Login como user normal pra simular auth
  const user = await pb.collection('users').authWithPassword('byemidias@gmail.com', '@Gaedaam08');
  console.log('Logged in:', user.record.email);

  // Agora tenta o endpoint do crud (precisa cookie de sessão, mas podemos simular)
  // Vou listar direto pra ver os fields
  const items = await pb.collection('media').getFullList();
  console.log('Total:', items.length);
  if (items[0]) {
    console.log('Fields do primeiro item:', Object.keys(items[0]));
    console.log('Primeiro item:', JSON.stringify(items[0], null, 2));
  }
})();
