'use client';

import { useEffect, useState, useCallback } from 'react';

interface LayoutZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'campaign' | 'mask' | 'logo' | 'clock' | 'weather' | 'text';
  playlist_id?: string;
  content?: string;
  config?: {
    format?: string;
    font_size?: number;
    color?: string;
    bg_color?: string;
    city?: string;
    units?: string;
    alignment?: string;
    image_url?: string;
    opacity?: number;
  };
}

interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  zones: LayoutZone[];
  is_default: boolean;
  status: string;
  created_at: string;
}

const PRESET_LAYOUTS: { name: string; icon: string; zones: Omit<LayoutZone, 'id'>[] }[] = [
  {
    name: 'Tela Cheia',
    icon: '🖥️',
    zones: [
      { name: 'Campanha Principal', x: 0, y: 0, width: 100, height: 100, type: 'campaign' },
    ],
  },
  {
    name: 'Split Horizontal',
    icon: '▬',
    zones: [
      { name: 'Campanha Superior', x: 0, y: 0, width: 100, height: 70, type: 'campaign' },
      { name: 'Máscara Inferior', x: 0, y: 70, width: 100, height: 30, type: 'mask' },
    ],
  },
  {
    name: 'Split Vertical',
    icon: '▮',
    zones: [
      { name: 'Campanha Esquerda', x: 0, y: 0, width: 70, height: 100, type: 'campaign' },
      { name: 'Máscara Direita', x: 70, y: 0, width: 30, height: 100, type: 'mask' },
    ],
  },
  {
    name: 'L-Shape',
    icon: '⌐',
    zones: [
      { name: 'Campanha Principal', x: 0, y: 0, width: 70, height: 70, type: 'campaign' },
      { name: 'Máscara Direita', x: 70, y: 0, width: 30, height: 100, type: 'mask' },
      { name: 'Máscara Inferior', x: 0, y: 70, width: 70, height: 30, type: 'mask' },
    ],
  },
  {
    name: 'Picture in Picture',
    icon: '⧉',
    zones: [
      { name: 'Campanha Principal', x: 0, y: 0, width: 100, height: 100, type: 'campaign' },
      { name: 'PIP', x: 65, y: 5, width: 30, height: 30, type: 'campaign' },
    ],
  },
  {
    name: '3 Colunas',
    icon: '☰',
    zones: [
      { name: 'Coluna 1', x: 0, y: 0, width: 33, height: 100, type: 'campaign' },
      { name: 'Coluna 2', x: 33, y: 0, width: 34, height: 100, type: 'campaign' },
      { name: 'Coluna 3', x: 67, y: 0, width: 33, height: 100, type: 'mask' },
    ],
  },
  {
    name: 'Grid 2x2',
    icon: '⊞',
    zones: [
      { name: 'Canto Superior Esquerdo', x: 0, y: 0, width: 50, height: 50, type: 'campaign' },
      { name: 'Canto Superior Direito', x: 50, y: 0, width: 50, height: 50, type: 'campaign' },
      { name: 'Canto Inferior Esquerdo', x: 0, y: 50, width: 50, height: 50, type: 'mask' },
      { name: 'Canto Inferior Direito', x: 50, y: 50, width: 50, height: 50, type: 'mask' },
    ],
  },
  {
    name: 'Relógio + Campanha',
    icon: '🕐',
    zones: [
      { name: 'Campanha', x: 0, y: 0, width: 80, height: 100, type: 'campaign' },
      { name: 'Relógio', x: 80, y: 0, width: 20, height: 50, type: 'clock' },
      { name: 'Clima', x: 80, y: 50, width: 20, height: 50, type: 'weather' },
    ],
  },
];

const ZONE_COLORS: Record<string, string> = {
  campaign: 'bg-blue-500/30 border-blue-500',
  mask: 'bg-purple-500/30 border-purple-500',
  logo: 'bg-yellow-500/30 border-yellow-500',
  clock: 'bg-green-500/30 border-green-500',
  weather: 'bg-cyan-500/30 border-cyan-500',
  text: 'bg-gray-500/30 border-gray-500',
};

export default function DiagramacaoPage() {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LayoutTemplate | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [screenWidth, setScreenWidth] = useState(1920);
  const [screenHeight, setScreenHeight] = useState(1080);
  const [zones, setZones] = useState<LayoutZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/layouts');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.error('Failed to fetch layouts', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const applyPreset = (index: number) => {
    const preset = PRESET_LAYOUTS[index];
    setSelectedPreset(index);
    setZones(preset.zones.map((z, i) => ({
      ...z,
      id: `zone-${Date.now()}-${i}`,
    })));
  };

  const addZone = (type: LayoutZone['type']) => {
    const newZone: LayoutZone = {
      id: `zone-${Date.now()}`,
      name: `Zona ${zones.length + 1}`,
      x: 0, y: 0, width: 30, height: 30,
      type,
    };
    setZones([...zones, newZone]);
    setSelectedZone(newZone.id);
  };

  const updateZone = (id: string, updates: Partial<LayoutZone>) => {
    setZones(zones.map(z => z.id === id ? { ...z, ...updates } : z));
  };

  const removeZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
    if (selectedZone === id) setSelectedZone(null);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const isEdit = editing && editing.id;
      await fetch('/api/admin/layouts', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: editing.id } : {}),
          name: templateName,
          description: templateDesc,
          width: screenWidth,
          height: screenHeight,
          zones,
        }),
      });
      setEditing(null);
      setTemplateName('');
      setTemplateDesc('');
      setZones([]);
      fetchTemplates();
    } catch (e) {
      console.error('Failed to save layout', e);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    try {
      await fetch(`/api/admin/layouts?id=${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (e) {
      console.error('Failed to delete layout', e);
    }
  };

  const selectedZoneData = zones.find(z => z.id === selectedZone);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Diagramação</h1>
        <button
          onClick={() => {
            setEditing({} as LayoutTemplate);
            setTemplateName('');
            setTemplateDesc('');
            setZones([]);
            setSelectedPreset(null);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Novo Template
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">
            {editing.id ? 'Editar Template' : 'Novo Template'}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome *</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Grade Padrão"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descrição</label>
              <input
                type="text"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Descrição do template"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Largura (px)</label>
              <input
                type="number"
                value={screenWidth}
                onChange={(e) => setScreenWidth(parseInt(e.target.value) || 1920)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Altura (px)</label>
              <input
                type="number"
                value={screenHeight}
                onChange={(e) => setScreenHeight(parseInt(e.target.value) || 1080)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white"
              />
            </div>
          </div>

          {/* Preset layouts */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Diagramação Predefinida</label>
            <div className="flex flex-wrap gap-3">
              {PRESET_LAYOUTS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => applyPreset(i)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-4 py-3 text-sm transition-colors ${
                    selectedPreset === i
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <span className="text-2xl">{preset.icon}</span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visual editor + zone list */}
          <div className="grid grid-cols-3 gap-4">
            {/* Preview */}
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-2">Preview</label>
              <div
                className="relative bg-gray-950 border border-gray-700 rounded-lg overflow-hidden"
                style={{ aspectRatio: `${screenWidth}/${screenHeight}` }}
              >
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone.id)}
                    className={`absolute border-2 rounded cursor-pointer transition-all overflow-hidden ${
                      ZONE_COLORS[zone.type]
                    } ${selectedZone === zone.id ? 'ring-2 ring-white' : ''}`}
                    style={{
                      left: `${zone.x}%`,
                      top: `${zone.y}%`,
                      width: `${zone.width}%`,
                      height: `${zone.height}%`,
                      backgroundColor: zone.type === 'mask' ? (zone.config?.bg_color || undefined) : undefined,
                      opacity: zone.type === 'mask' && zone.config?.opacity != null ? zone.config.opacity / 100 : undefined,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-center p-1">
                      {zone.type === 'clock' ? (
                        <div style={{ color: zone.config?.color || '#fff', fontSize: `${Math.max(8, (zone.config?.font_size || 48) / 10)}px` }}>
                          <div className="font-mono font-bold">{zone.config?.format === '12h' ? '2:30 PM' : '14:30'}</div>
                          <div className="text-[8px] opacity-60">Relogio</div>
                        </div>
                      ) : zone.type === 'weather' ? (
                        <div style={{ color: zone.config?.color || '#fff', fontSize: `${Math.max(8, (zone.config?.font_size || 36) / 10)}px` }}>
                          <div className="font-bold">27°C</div>
                          <div className="text-[8px] opacity-60">{zone.config?.city || 'Sao Paulo'}</div>
                        </div>
                      ) : zone.type === 'text' ? (
                        <div
                          style={{ color: zone.config?.color || '#fff', fontSize: `${Math.max(8, (zone.config?.font_size || 24) / 10)}px`, textAlign: (zone.config?.alignment as 'center') || 'center' }}
                          dangerouslySetInnerHTML={{ __html: zone.content || 'Texto...' }}
                        />
                      ) : zone.type === 'logo' ? (
                        zone.config?.image_url ? (
                          <img src={zone.config.image_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <div className="text-yellow-400 font-bold">Logo</div>
                        )
                      ) : (
                        <span className="text-white/70">{zone.name}</span>
                      )}
                    </div>
                  </div>
                ))}
                {zones.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
                    Selecione um layout predefinido ou adicione zonas
                  </div>
                )}
              </div>
            </div>

            {/* Zone list + controls */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Adicionar Zona</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'campaign', label: 'Campanha' },
                    { key: 'clock', label: 'Relogio' },
                    { key: 'weather', label: 'Clima' },
                    { key: 'text', label: 'Texto' },
                    { key: 'logo', label: 'Logo' },
                    { key: 'mask', label: 'Fundo' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => addZone(key)}
                      className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                    >
                      + {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto">
                {zones.map((zone) => (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZone(zone.id)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer ${
                      selectedZone === zone.id ? 'bg-gray-700 text-white' : 'bg-gray-800/50 text-gray-400'
                    }`}
                  >
                    <span>{zone.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Selected zone editor */}
              {selectedZoneData && (
                <div className="rounded-lg bg-gray-800 p-3 space-y-2">
                  <input
                    type="text"
                    value={selectedZoneData.name}
                    onChange={(e) => updateZone(selectedZoneData.id, { name: e.target.value })}
                    className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">X%</label>
                      <input type="number" value={selectedZoneData.x}
                        onChange={(e) => updateZone(selectedZoneData.id, { x: +e.target.value })}
                        className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Y%</label>
                      <input type="number" value={selectedZoneData.y}
                        onChange={(e) => updateZone(selectedZoneData.id, { y: +e.target.value })}
                        className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Largura%</label>
                      <input type="number" value={selectedZoneData.width}
                        onChange={(e) => updateZone(selectedZoneData.id, { width: +e.target.value })}
                        className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Altura%</label>
                      <input type="number" value={selectedZoneData.height}
                        onChange={(e) => updateZone(selectedZoneData.id, { height: +e.target.value })}
                        className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                    </div>
                  </div>

                  {/* Widget-specific config */}
                  {selectedZoneData.type === 'clock' && (
                    <div className="border-t border-gray-700 pt-2 mt-2 space-y-2">
                      <p className="text-xs text-blue-400 font-medium">Widget: Relogio</p>
                      <div>
                        <label className="text-xs text-gray-500">Formato</label>
                        <select value={selectedZoneData.config?.format || '24h'}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, format: e.target.value } })}
                          className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs">
                          <option value="24h">24 horas</option>
                          <option value="12h">12 horas (AM/PM)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Tamanho da fonte</label>
                        <input type="number" value={selectedZoneData.config?.font_size || 48}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, font_size: +e.target.value } })}
                          className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Cor</label>
                        <input type="color" value={selectedZoneData.config?.color || '#FFFFFF'}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, color: e.target.value } })}
                          className="w-full h-7 rounded bg-gray-700 border border-gray-600 cursor-pointer" />
                      </div>
                    </div>
                  )}

                  {selectedZoneData.type === 'weather' && (
                    <div className="border-t border-gray-700 pt-2 mt-2 space-y-2">
                      <p className="text-xs text-cyan-400 font-medium">Widget: Clima</p>
                      <div>
                        <label className="text-xs text-gray-500">Cidade</label>
                        <input type="text" value={selectedZoneData.config?.city || 'Sao Paulo'}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, city: e.target.value } })}
                          placeholder="Sao Paulo"
                          className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Unidade</label>
                        <select value={selectedZoneData.config?.units || 'celsius'}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, units: e.target.value } })}
                          className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs">
                          <option value="celsius">Celsius</option>
                          <option value="fahrenheit">Fahrenheit</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Tamanho da fonte</label>
                        <input type="number" value={selectedZoneData.config?.font_size || 36}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, font_size: +e.target.value } })}
                          className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Cor</label>
                        <input type="color" value={selectedZoneData.config?.color || '#FFFFFF'}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, color: e.target.value } })}
                          className="w-full h-7 rounded bg-gray-700 border border-gray-600 cursor-pointer" />
                      </div>
                    </div>
                  )}

                  {selectedZoneData.type === 'text' && (
                    <div className="border-t border-gray-700 pt-2 mt-2 space-y-2">
                      <p className="text-xs text-gray-400 font-medium">Widget: Texto</p>
                      {/* Rich text toolbar */}
                      <div className="flex flex-wrap gap-1 p-1 bg-gray-900 rounded">
                        <button onClick={() => document.execCommand('bold')} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700 font-bold" title="Negrito">B</button>
                        <button onClick={() => document.execCommand('italic')} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700 italic" title="Italico">I</button>
                        <button onClick={() => document.execCommand('underline')} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700 underline" title="Sublinhado">U</button>
                        <div className="w-px bg-gray-700 mx-1" />
                        <button onClick={() => document.execCommand('justifyLeft')} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700" title="Esquerda">⫷</button>
                        <button onClick={() => document.execCommand('justifyCenter')} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700" title="Centro">☰</button>
                        <button onClick={() => document.execCommand('justifyRight')} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700" title="Direita">⫸</button>
                        <div className="w-px bg-gray-700 mx-1" />
                        <button onClick={() => document.execCommand('insertUnorderedList')} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700" title="Lista">•≡</button>
                        <button onClick={() => { const url = prompt('URL do link:'); if (url) document.execCommand('createLink', false, url); }} className="px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700" title="Link">🔗</button>
                      </div>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: selectedZoneData.content || '' }}
                        onBlur={(e) => updateZone(selectedZoneData.id, { content: e.currentTarget.innerHTML })}
                        className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-2 text-white text-sm min-h-[80px] max-h-[200px] overflow-y-auto focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{ textAlign: (selectedZoneData.config?.alignment as 'center') || 'center' }}
                      />
                      <div>
                        <label className="text-xs text-gray-500">Tamanho da fonte</label>
                        <input type="number" value={selectedZoneData.config?.font_size || 24}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, font_size: +e.target.value } })}
                          className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">Cor</label>
                          <input type="color" value={selectedZoneData.config?.color || '#FFFFFF'}
                            onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, color: e.target.value } })}
                            className="w-full h-7 rounded bg-gray-700 border border-gray-600 cursor-pointer" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Alinhamento</label>
                          <select value={selectedZoneData.config?.alignment || 'center'}
                            onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, alignment: e.target.value } })}
                            className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs">
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                            <option value="right">Direita</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedZoneData.type === 'logo' && (
                    <div className="border-t border-gray-700 pt-2 mt-2 space-y-2">
                      <p className="text-xs text-yellow-400 font-medium">Widget: Logo</p>
                      <div>
                        <label className="text-xs text-gray-500">URL da imagem</label>
                        <input type="text" value={selectedZoneData.config?.image_url || ''}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, image_url: e.target.value } })}
                          placeholder="https://..."
                          className="w-full rounded bg-gray-700 border border-gray-600 px-2 py-1 text-white text-xs" />
                      </div>
                    </div>
                  )}

                  {selectedZoneData.type === 'mask' && (
                    <div className="border-t border-gray-700 pt-2 mt-2 space-y-2">
                      <p className="text-xs text-purple-400 font-medium">Widget: Fundo/Mask</p>
                      <div>
                        <label className="text-xs text-gray-500">Cor de fundo</label>
                        <input type="color" value={selectedZoneData.config?.bg_color || '#1F2937'}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, bg_color: e.target.value } })}
                          className="w-full h-7 rounded bg-gray-700 border border-gray-600 cursor-pointer" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Opacidade: {selectedZoneData.config?.opacity ?? 100}%</label>
                        <input type="range" min={0} max={100} value={selectedZoneData.config?.opacity ?? 100}
                          onChange={(e) => updateZone(selectedZoneData.id, { config: { ...selectedZoneData.config, opacity: +e.target.value } })}
                          className="w-full" />
                      </div>
                    </div>
                  )}

                  {selectedZoneData.type === 'campaign' && (
                    <div className="border-t border-gray-700 pt-2 mt-2 space-y-2">
                      <p className="text-xs text-blue-400 font-medium">Zona de Campanha</p>
                      <p className="text-xs text-gray-500">Esta zona exibe o conteudo da campanha vinculada ao dispositivo.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={saveTemplate} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              Salvar
            </button>
            <button onClick={() => setEditing(null)} className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Templates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl bg-gray-900 border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">{t.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${t.is_default ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
                {t.is_default ? 'Padrão' : t.status}
              </span>
            </div>
            {t.description && <p className="text-sm text-gray-400 mb-2">{t.description}</p>}
            <div className="text-xs text-gray-500 mb-3">
              {t.width}x{t.height} • {t.zones?.length || 0} zona(s)
            </div>
            {/* Mini preview */}
            <div className="relative bg-gray-950 rounded border border-gray-700 mb-3" style={{ aspectRatio: `${t.width}/${t.height}` }}>
              {(t.zones || []).map((zone: LayoutZone) => (
                <div
                  key={zone.id}
                  className={`absolute border ${ZONE_COLORS[zone.type]}`}
                  style={{
                    left: `${zone.x}%`, top: `${zone.y}%`,
                    width: `${zone.width}%`, height: `${zone.height}%`,
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditing(t);
                  setTemplateName(t.name);
                  setTemplateDesc(t.description || '');
                  setScreenWidth(t.width);
                  setScreenHeight(t.height);
                  setZones(t.zones || []);
                }}
                className="rounded bg-gray-800 px-3 py-1 text-xs text-gray-300 hover:bg-gray-700"
              >
                Editar
              </button>
              <button
                onClick={() => deleteTemplate(t.id)}
                className="rounded bg-gray-800 px-3 py-1 text-xs text-red-400 hover:bg-red-900/30"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}

        {templates.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nenhum template criado. Clique &quot;+ Novo Template&quot; para começar.
          </div>
        )}
      </div>
    </div>
  );
}
