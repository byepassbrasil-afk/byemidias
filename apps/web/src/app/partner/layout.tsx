// Pass-through layout. O layout visual fica em:
//   - /partner/[slug]/layout.tsx  (autenticado, com sidebar)
//   - pages de login/signup (sem sidebar, fullscreen)
//
// Esse layout existe só para casar com o segmento /partner/* sem
// interferir visualmente. Renderizar children direto garante que
// /partner/login e /partner/[slug]/login não herdem uma sidebar errada
// que pertence a /partner/page.tsx.
export default function PartnerRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
