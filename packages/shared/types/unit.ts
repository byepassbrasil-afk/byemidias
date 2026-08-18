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
