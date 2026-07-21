// supabase/functions/publish-scheduled-posts/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date().toISOString();

    // Find all posts due to be published
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id, caption, user_id')
      .eq('published', false)
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', now);

    if (fetchError) throw fetchError;

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, published: 0, message: 'No posts due.' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Publish them
    const ids = posts.map(p => p.id);

    const { error: updateError } = await supabase
      .from('posts')
      .update({ published: true, scheduled_for: null })
      .in('id', ids);

    if (updateError) throw updateError;

    console.log(`Published ${posts.length} scheduled post(s):`, ids);

    return new Response(
      JSON.stringify({ ok: true, published: posts.length, ids }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('publish-scheduled-posts error:', e.message);
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
