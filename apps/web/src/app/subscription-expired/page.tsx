export default function SubscriptionExpiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Assinatura Expirada</h1>
        <p className="text-gray-600 mb-8">
          Sua assinatura expirou. Entre em contato com o suporte para renovar seu acesso.
        </p>
        <a href="/login"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
          Voltar ao Login
        </a>
      </div>
    </div>
  );
}
