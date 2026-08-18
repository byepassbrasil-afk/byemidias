// Edge Function: /device/sync
// Returns playlists, media, and campaigns for the device

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

    const url = new URL(req.url);
    const deviceId = url.searchParams.get("device_id");
    const contentVersion = parseInt(url.searchParams.get("content_version") ?? "0");

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: "device_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get device info
    const { data: device } = await supabase
      .from("devices")
      .select("organization_id, unit_id, group_id")
      .eq("id", deviceId)
      .single();

    if (!device) {
      return new Response(
        JSON.stringify({ error: "Device not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get campaigns targeting this device
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("*")
      .eq("organization_id", device.organization_id)
      .eq("status", "active");

    // Filter campaigns that target this device
    const targetedCampaigns = [];
    for (const campaign of campaigns ?? []) {
      const { data: targets } = await supabase
        .from("campaign_targets")
        .select("*")
        .eq("campaign_id", campaign.id);

      const isTargeted = targets?.some(
        (t) =>
          t.target_id === deviceId ||
          t.target_id === device.unit_id ||
          t.target_id === device.group_id
      );

      if (isTargeted || targets?.length === 0) {
        targetedCampaigns.push(campaign);
      }
    }

    // Get playlists for targeted campaigns
    const playlistIds = [...new Set(targetedCampaigns.map((c) => c.playlist_id))];

    const { data: playlists } = await supabase
      .from("playlists")
      .select("*, playlist_items(*)")
      .in("id", playlistIds);

    // Get all media referenced in playlists
    const mediaIds = new Set<string>();
    for (const pl of playlists ?? []) {
      for (const item of pl.playlist_items ?? []) {
        mediaIds.add(item.media_id);
      }
    }

    const { data: media } = await supabase
      .from("media")
      .select("*")
      .in("id", [...mediaIds]);

    const newVersion = Math.max(contentVersion + 1, Date.now() % 1000000);

    return new Response(
      JSON.stringify({
        content_version: newVersion,
        playlists: playlists?.map((pl) => ({
          id: pl.id,
          name: pl.name,
          description: pl.description,
          items: pl.playlist_items,
        })) ?? [],
        media: media ?? [],
        campaigns: targetedCampaigns,
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
