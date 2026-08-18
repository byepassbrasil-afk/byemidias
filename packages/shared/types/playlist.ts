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
  created_at: string;
}
