export type SyncStatus = 'success' | 'partial' | 'failed';

export interface SyncLog {
  id: string;
  device_id: string;
  content_version: number;
  status: SyncStatus;
  details: Record<string, unknown>;
  created_at: string;
}

export type DeviceCommandType = 'restart' | 'sync' | 'update_playlist' | 'clear_cache' | 'update_app' | 'reload_content' | 'reboot' | 'capture_info';
export type DeviceCommandStatus = 'pending' | 'sent' | 'executed' | 'failed' | 'timeout';

export interface DeviceCommand {
  id: string;
  device_id: string;
  command: DeviceCommandType;
  status: DeviceCommandStatus;
  result: Record<string, unknown> | null;
  created_at: string;
  executed_at: string | null;
}

export interface PlaybackLog {
  id: string;
  device_id: string;
  media_id: string | null;
  campaign_id: string | null;
  started_at: string;
  ended_at: string | null;
}
