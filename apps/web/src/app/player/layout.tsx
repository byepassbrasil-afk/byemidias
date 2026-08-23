export const metadata = {
  title: 'ByeMidias Player',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
        `}</style>
      </head>
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', background: '#000' }}>
        {children}
      </body>
    </html>
  );
}
