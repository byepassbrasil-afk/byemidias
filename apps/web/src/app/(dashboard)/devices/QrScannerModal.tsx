'use client';

import { useEffect, useRef, useState } from 'react';

interface QrScannerModalProps {
  onClose: () => void;
  onScanned: (text: string) => void;
}

export default function QrScannerModal({ onClose, onScanned }: QrScannerModalProps) {
  const scannerRef = useRef<any>(null);
  const containerId = 'qr-scanner-container';
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const stoppedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const mod = await import('html5-qrcode');
        if (!mounted) return;
        const { Html5Qrcode } = mod;
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decodedText: string) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            try { scanner.stop().catch(() => {}); } catch {}
            onScanned(decodedText);
          },
          (_err: string) => { /* ignore scan failures */ },
        );
      } catch (e: any) {
        if (!mounted) return;
        const msg = e?.message || String(e);
        if (msg.includes('NotAllowed') || msg.includes('Permission')) {
          setError('Permissão de câmera negada. Use o campo manual abaixo.');
        } else if (msg.includes('NotFound') || msg.includes('no camera')) {
          setError('Nenhuma câmera encontrada neste dispositivo. Use o campo manual abaixo.');
        } else {
          setError(`Erro ao iniciar câmera: ${msg}`);
        }
      }
    }

    start();

    return () => {
      mounted = false;
      stoppedRef.current = true;
      const scanner = scannerRef.current;
      if (scanner) {
        try { scanner.stop().catch(() => {}); } catch {}
      }
    };
  }, [onScanned]);

  function submitManual() {
    const v = manualValue.trim();
    if (v) onScanned(v);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">📱 Ler QR Code</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-yellow-900/20 border border-yellow-700/50 p-3 text-sm text-yellow-300">
              {error}
            </div>
          )}

          <div className="relative bg-black rounded-xl overflow-hidden mb-4" style={{ minHeight: '280px' }}>
            <div id={containerId} className="w-full" />
          </div>

          <div className="text-center text-xs text-gray-500 mb-4">
            Aponte a câmera para o QR Code exibido no dispositivo
          </div>

          <div className="border-t border-gray-800 pt-4">
            <label className="block text-xs text-gray-400 mb-2">Ou cole o UUID manualmente:</label>
            <div className="flex gap-2">
              <input
                value={manualValue}
                onChange={e => setManualValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitManual(); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <button onClick={submitManual} className="px-4 py-2 rounded-lg bg-cyan-600 text-sm font-semibold text-white hover:bg-cyan-500">
                Buscar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
