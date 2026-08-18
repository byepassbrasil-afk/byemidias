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
