export type OrganizationStatus = 'active' | 'inactive' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Record<string, unknown>;
  status: OrganizationStatus;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'invited' | 'pending_invite';

export interface Profile {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export type DeviceStatus = 'online' | 'offline' | 'syncing' | 'error' | 'inactive';

export interface Device {
  id: string;
  device_uuid: string;
  organization_id: string;
  unit_id: string | null;
  group_id: string | null;
  name: string;
  model: string | null;
  manufacturer: string | null;
  os_version: string | null;
  player_version: string | null;
  resolution: string | null;
  orientation: 'landscape' | 'portrait';
  status: DeviceStatus;
  last_heartbeat: string | null;
  last_sync: string | null;
  ip_address: string | null;
  storage_total: number | null;
  storage_used: number | null;
  activation_code: string | null;
  activation_expires_at: string | null;
  is_activated: boolean;
  campaign_id: string | null;
  layout_template_id: string | null;
  content_version: number;
  screen_rotation: number;
  mirror_horizontal: boolean;
  mirror_vertical: boolean;
  support_id: string | null;
  support_type: string;
  restart_requested: boolean;
  last_screenshot: string | null;
  screenshot_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceHeartbeat {
  id: string;
  device_id: string;
  timestamp: string;
  player_version: string | null;
  status: DeviceStatus;
  storage_available: number | null;
  current_content: string | null;
  current_playlist: string | null;
  error_message: string | null;
}

export type MediaType = 'image' | 'video' | 'gif' | 'pdf' | 'html' | 'url' | 'text' | 'template' | 'widget';

export interface Media {
  id: string;
  organization_id: string;
  name: string;
  type: MediaType;
  file_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Playlist {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  media_id: string;
  position: number;
  duration: number | null;
  transition: string | null;
  volume: number | null;
  created_at: string;
}

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

export type PartnerAccessStatus = 'active' | 'inactive';

export interface PartnerAccess {
  id: string;
  organization_id: string;
  username: string;
  display_name: string;
  status: PartnerAccessStatus;
  created_at: string;
  updated_at: string;
}

export interface PartnerDevice {
  id: string;
  partner_access_id: string;
  device_id: string;
  playlist_id: string | null;
  created_at: string;
}

export interface PartnerDeviceWithInfo extends PartnerDevice {
  device_name: string;
  device_status: string;
  device_uuid: string;
  playlist_name: string | null;
}

export interface PartnerMediaUpload {
  id: string;
  partner_access_id: string;
  media_id: string;
  created_at: string;
}
