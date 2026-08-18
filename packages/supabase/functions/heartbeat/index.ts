// Edge Function: /device/heartbeat
// Supabase Edge Function (Deno)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      device_id,
      status,
      player_version,
      storage_available,
      current_content,
      current_playlist,
      error_message,
    } = await req.json();

    // Insert heartbeat
    const { error: hbError } = await supabase
      .from("device_heartbeats")
      .insert({
        device_id,
        timestamp: new Date().toISOString(),
        player_version,
        status,
        storage_available,
        current_content,
        current_playlist,
        error_message,
      });

    if (hbError) throw hbError;

    // Update device status
    const { error: devError } = await supabase
      .from("devices")
      .update({
        status,
        last_heartbeat: new Date().toISOString(),
        player_version,
      })
      .eq("id", device_id);

    if (devError) throw devError;

    // Check for pending commands
    const { data: commands } = await supabase
      .from("device_commands")
      .select("id, command, status")
      .eq("device_id", device_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    return new Response(
      JSON.stringify({
        success: true,
        commands: commands ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
