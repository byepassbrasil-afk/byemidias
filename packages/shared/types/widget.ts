export interface WidgetConfig {
  id: string;
  organization_id: string;
  widget_type: 'weather' | 'news' | 'clock' | 'web_page' | 'dynamic_text' | 'qr_code' | 'lottery' | 'indicator';
  name: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
