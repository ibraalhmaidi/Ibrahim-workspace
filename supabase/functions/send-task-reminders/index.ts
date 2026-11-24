import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const auth = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  const oneSignalKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const appId = Deno.env.get("ONESIGNAL_APP_ID") || "29e4a84a-aa52-4b1a-aa72-b9dc944ddbe9";
  if (!oneSignalKey) return new Response("Missing ONESIGNAL_REST_API_KEY", { status: 500, headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: tasks, error } = await db.from("tasks")
    .select("id,user_id,title,due")
    .eq("done", false)
    .is("notified_at", null)
    .not("due", "is", null)
    .gte("due", cutoff)
    .lte("due", new Date().toISOString())
    .limit(100);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const results = [];
  for (const task of tasks || []) {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Key ${oneSignalKey}` },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        include_aliases: { external_id: [task.user_id] },
        headings: { en: "مساحة إبراهيم", ar: "مساحة إبراهيم" },
        contents: { en: `حان موعد المهمة: ${task.title}`, ar: `حان موعد المهمة: ${task.title}` },
        data: { task_id: task.id, url: "https://ibraalhmaidi.github.io/Ibrahim-workspace/" }
      })
    });

    const body = await response.text();
    if (response.ok) {
      const { error: updateError } = await db.from("tasks")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", task.id)
        .is("notified_at", null);
      results.push({ task_id: task.id, sent: !updateError, update_error: updateError?.message });
    } else {
      results.push({ task_id: task.id, sent: false, error: body });
    }
  }

  return new Response(JSON.stringify({ checked: tasks?.length || 0, results }), {
    headers: { ...cors, "Content-Type": "application/json" }
  });
});
