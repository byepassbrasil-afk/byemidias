export async function GET() {
  return Response.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
  });
}
