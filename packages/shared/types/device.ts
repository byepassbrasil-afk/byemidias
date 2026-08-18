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
