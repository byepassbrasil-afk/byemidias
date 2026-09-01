'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Campaign, CampaignStatus } from '@/lib/types';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

interface CampaignPlaylistLink {
  id: string;
  campaign_id: string;
  playlist_id: string;
  position: number;
  playlists?: { id: string; name: string } | null;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string }[]>([]);
  const [links, setLinks] = useState<CampaignPlaylistLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [campRes, orgRes, playlistRes, linkRes] = await Promise.all([
        fetch('/api/admin/crud/campaigns?order=created_at&asc=false'),
        fetch('/api/admin/crud/organizations?order=name'),
        fetch('/api/admin/crud/playlists?order=name'),
        fetch('/api/admin/crud/campaign_playlists?order=position'),
      ]);
      const campJson = await campRes.json();
      const orgJson = await orgRes.json();
      const playlistJson = await playlistRes.json();
      const linkJson = await linkRes.json();
      setCampaigns(campJson.data ?? []);
      setOrgs((orgJson.data ?? []) as { id: string; name: string }[]);
      setPlaylists((playlistJson.data ?? []) as { id: string; name: string }[]);
      setLinks((linkJson.data ?? []) as CampaignPlaylistLink[]);
    } catch (e) {
      console.error('Failed to load campaigns', e);
    }
    setLoading(false);
  }

  function linksForCampaign(campaignId: string): CampaignPlaylistLink[] {
    return links
      .filter(l => l.campaign_id === campaignId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: '📝' },
    active: { label: 'Ativa', color: 'bg-green-100 text-green-800 border-green-300', icon: '🟢' },
    paused: { label: 'Pausada', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⏸️' },
    ended: { label: 'Finalizada', color: 'bg-red-100 text-red-800 border-red-300', icon: '🔴' },
    archived: { label: 'Arquivada', color: 'bg-gray-100 text-gray-500 border-gray-300', icon: '📦' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} • Clique em um card para ver a programação semanal
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/campaigns/new')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nova Campanha
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm border border-gray-200 text-center"><p className="text-gray-500">Nenhuma campanha encontrada.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => {
            const sConf = statusConfig[c.status] ?? statusConfig.draft;
            const campaignLinks = linksForCampaign(c.id);
            const isExpanded = expandedCampaignId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-xl bg-white shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{sConf.icon}</span>
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border ${sConf.color}`}>
                    {sConf.label}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Início:</span>
                    <span className="font-medium text-gray-700">{formatDate(c.start_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fim:</span>
                    <span className="font-medium text-gray-700">{formatDate(c.end_date)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      📋 Playlists Vinculadas
                    </h4>
                    <button
                      type="button"
                      onClick={() => setExpandedCampaignId(isExpanded ? null : c.id)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      {isExpanded ? '▲ Ocultar' : `▶ Ver (${campaignLinks.length})`}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="bg-gray-50 rounded-md p-2 space-y-1.5">
                      {campaignLinks.length === 0 ? (
                        <p className="text-xs text-gray-500 italic px-1 py-1">Nenhuma playlist vinculada</p>
                      ) : (
                        campaignLinks.map((l, i) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between px-2 py-1.5 bg-white rounded border border-gray-200"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-gray-400 w-6 text-right">
                                #{i + 1}
                              </span>
                              <span className="text-sm text-gray-900 truncate">
                                {l.playlists?.name || 'Playlist'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">Pos: {l.position}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200">
                  <button
                    onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                    className="flex-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 py-1.5 text-xs font-medium"
                  >
                    📅 Programação
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/campaigns/${c.id}?edit=1`)}
                    className="flex-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 py-1.5 text-xs font-medium"
                  >
                    ✏️ Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
