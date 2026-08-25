import sql from '@/lib/db'

export { sql }

// Helper: convert supabase-style .from().select().eq() to neon sql`` queries
// Usage pattern for migration:
//
// BEFORE: const { data } = await supabase.from('table').select('*').eq('id', id).single()
// AFTER:  const [data] = await sql`SELECT * FROM table WHERE id = ${id}`
//
// BEFORE: const { data, error } = await supabase.from('table').insert({...}).select().single()
// AFTER:  const [data] = await sql`INSERT INTO table ${sql(data)} RETURNING *`
//
// BEFORE: await supabase.from('table').update({...}).eq('id', id)
// AFTER:  await sql`UPDATE table SET ${sql(updates)} WHERE id = ${id}`
//
// BEFORE: await supabase.from('table').delete().eq('id', id)
// AFTER:  await sql`DELETE FROM table WHERE id = ${id}`
//
// BEFORE: await supabase.rpc('function_name', { param: value })
// AFTER:  await sql`SELECT function_name(${value})`
