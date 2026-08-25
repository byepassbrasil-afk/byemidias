import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: { rejectUnauthorized: false },
})

export default sql
