const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qfotxfxzgcnbmtznlhfc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3R4Znh6Z2NuYm10em5saGZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njg3MDMzOSwiZXhwIjoyMTAyNDQ2MzM5fQ.FzE-gZlES6dL4wCzfOmC7W2IiiPC8hjS-etnEOQxQ7A'
);

async function run() {
  // Create media bucket without size limit
  const { error: e1 } = await supabase.storage.createBucket('media', {
    public: true,
  });
  console.log('media bucket:', e1 ? e1.message : 'OK');

  // List buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('\nAll buckets:');
  buckets?.forEach(b => console.log(`  ${b.name} (public: ${b.public})`));
}

run();
