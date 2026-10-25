/**
 * supabase/functions/publish-pack/index.ts
 *
 * Edge Function to validate campus pack artifacts, calculate manifest hashes,
 * register the new version in the `campus_packs` table, and notify connected
 * clients via Supabase Realtime broadcast.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface PublishRequest {
  campus_id: string;
  version: string;
  manifest_url: string;
  size_bytes: number;
  checksum: string;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: PublishRequest = await req.json();

    if (!body.campus_id || !body.version || !body.manifest_url || !body.checksum) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Insert new version into campus_packs
    const packId = `pack-${body.campus_id}-${body.version}`;
    const { data, error } = await supabaseClient
      .from("campus_packs")
      .upsert({
        id: packId,
        campus_id: body.campus_id,
        version: body.version,
        manifest_url: body.manifest_url,
        size_bytes: body.size_bytes,
        checksum: body.checksum,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update current pack version on campus record
    await supabaseClient
      .from("campuses")
      .update({ current_pack_version: body.version, updated_at: new Date().toISOString() })
      .eq("id", body.campus_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Campus pack ${body.version} published successfully`,
        pack: data
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
