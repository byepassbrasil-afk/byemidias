import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false },
})

export default sql

/**
 * Bump content_version on all devices for an org.
 * Call this whenever content changes (playlist/media/campaign edits).
 * The sync endpoint NO longer auto-increments — it only reads the version.
 */
export async function bumpContentVersion(organizationId: string) {
  await sql`UPDATE devices SET content_version = content_version + 1 WHERE organization_id = ${organizationId}`
}
