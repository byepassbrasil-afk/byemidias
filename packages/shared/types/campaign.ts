export type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';

export interface Campaign {
  id: string;
  organization_id: string;
  playlist_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: number[];
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignTarget {
  id: string;
  campaign_id: string;
  target_type: 'unit' | 'group' | 'device';
  target_id: string;
  created_at: string;
}
