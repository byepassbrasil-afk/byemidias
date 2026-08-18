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
