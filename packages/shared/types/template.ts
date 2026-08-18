export interface Template {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  layout_json: LayoutData;
  thumbnail_url: string | null;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface LayoutData {
  width: number;
  height: number;
  elements: LayoutElement[];
}

export interface LayoutElement {
  id: string;
  type: 'image' | 'video' | 'text' | 'widget' | 'qr_code' | 'web_page';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  properties: Record<string, unknown>;
}
