// Edge Function: /device/activate
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
      device_uuid,
      activation_code,
      model,
      manufacturer,
      os_version,
      player_version,
      resolution,
    } = await req.json();

    // Validate activation code
    const { data: codeData, error: codeError } = await supabase
      .from("devices")
      .select("id, organization_id, activation_expires_at")
      .eq("activation_code", activation_code)
      .eq("is_activated", false)
      .single();

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: "Código de ativação inválido ou já utilizado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (codeData.activation_expires_at) {
      const expires = new Date(codeData.activation_expires_at);
      if (expires < new Date()) {
        return new Response(
          JSON.stringify({ error: "Código de ativação expirado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Activate device
    const { error: updateError } = await supabase
      .from("devices")
      .update({
        device_uuid,
        model,
        manufacturer,
        os_version,
        player_version,
        resolution,
        is_activated: true,
        status: "online",
        last_heartbeat: new Date().toISOString(),
        activation_code: null,
        activation_expires_at: null,
      })
      .eq("id", codeData.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        device_id: codeData.id,
        organization_id: codeData.organization_id,
        api_base_url: supabaseUrl,
        supabase_url: supabaseUrl,
        supabase_anon_key: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        content_version: 0,
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
