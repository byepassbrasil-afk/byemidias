const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qfotxfxzgcnbmtznlhfc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3R4Znh6Z2NuYm10em5saGZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg3MDMzOSwiZXhwIjoyMTAyNDQ2MzM5fQ.FzE-gZlES6dL4wCzfOmC7W2IiiPC8hjS-etnEOQxQ7A'
);

async function run() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'gwmorata@gmail.com',
    password: '@Gaedaam08',
    email_confirm: true,
    user_metadata: {
      full_name: 'Gabriel Admin',
      role: 'super_admin'
    }
  });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('User created:', data.user.id);
    console.log('Email:', data.user.email);
  }
}

run();
