const bcrypt = require('bcryptjs');

const hash = '$2a$06$jP51kqPgGWKSPrYNDHdsqe4pXYTsqcNc1qwGpW9rucdUbY3KBgY6i';

async function test() {
  console.log('Verify "damares":', await bcrypt.compare('damares', hash));
  console.log('Verify "damare$":', await bcrypt.compare('damare$', hash));
  console.log('Verify "123456":', await bcrypt.compare('123456', hash));
}

test();
