// Supabase Edge Function: keepalive
// Deploy: supabase functions deploy keepalive
// Schedule: supabase functions schedule keepalive --cron "0 */3 * * *" (every 3 days)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const startTime = Date.now()

    // Run a simple query to keep the DB active
    const { count, error } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })

    if (error) {
      throw error
    }

    // Log the keepalive
    await supabase.from('keepalive_log').insert({
      checked_at: new Date().toISOString(),
      device_count: count || 0,
      response_ms: Date.now() - startTime,
    })

    // Cleanup old logs (keep last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    await supabase
      .from('keepalive_log')
      .delete()
      .lt('checked_at', thirtyDaysAgo.toISOString())

    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        device_count: count || 0,
        response_ms: Date.now() - startTime,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'error', error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
