/**
 * API type definitions — match backend Pydantic schemas exactly.
 */

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type EventCategory =
  | 'potential_sand_mining'
  | 'potential_land_excavation'
  | 'potential_land_filling'
  | 'vegetation_loss'
  | 'water_body_alteration'
  | 'general_disturbance'
  | 'unknown';

export type EventStatus =
  | 'unreviewed'
  | 'under_review'
  | 'confirmed_disturbance'
  | 'false_positive'
  | 'requires_field_verification'
  | 'closed';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
export type DataQuality = 'high' | 'medium' | 'low' | 'insufficient';

export interface GeoJSONGeometry {
  type: string;
  coordinates: unknown[];
}

export interface Site {
  id: string;
  name: string;
  description: string | null;
  geometry: GeoJSONGeometry;
  area_ha: number | null;
  status: string;
  is_demo: boolean;
  monitoring_enabled: boolean;
  monitoring_interval_days: number;
  cloud_threshold: number;
  min_valid_pixels: number;
  risk_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface SiteListResponse {
  total: number;
  items: Site[];
}

export interface ForensicEvent {
  id: string;
  event_id: string;
  site_id: string;
  category: EventCategory;
  status: EventStatus;
  first_observed: string | null;
  last_observed: string | null;
  observation_count: number;
  geometry: GeoJSONGeometry | null;
  area_ha: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  confidence: number | null;
  distance_to_river_m: number | null;
  distance_to_road_m: number | null;
  distance_to_protected_area_m: number | null;
  inside_mining_lease: boolean | null;
  lease_data_available: boolean;
  explanation: string | null;
  limitations: string | null;
  recommended_actions: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventListResponse {
  total: number;
  items: ForensicEvent[];
}

export interface SystemStatus {
  demo_mode: boolean;
  copernicus_available: boolean;
  earth_engine_available: boolean;
  active_signals: {
    critical: number;
    high: number;
    moderate: number;
  };
  sites_monitored: number;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  demo_mode: boolean;
}

export interface Observation {
  id: string;
  site_id: string;
  provider: string;
  collection: string;
  scene_id: string;
  acquisition_date: string;
  cloud_pct_scene: number | null;
  cloud_pct_aoi: number | null;
  valid_pixel_pct: number | null;
  data_quality: DataQuality;
  status: string;
  is_demo: boolean;
  created_at: string;
}

export interface Job {
  id: string;
  job_type: string;
  site_id: string | null;
  status: JobStatus;
  params: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  retries: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ── Earth Engine ──────────────────────────────────────────────────────────────

export interface EEStatus {
  available: boolean;
  project: string;
}

export interface EEDateRange {
  start: string;
  end: string;
}

export interface EETileResponse {
  tile_url: string;
  vis_type: string;
  date_range: EEDateRange;
  source: string;
}

export interface EEOverview {
  scene_count: number;
  date_range: EEDateRange;
  tiles: {
    true_color: string;
    ndvi: string;
    ndwi: string;
    bsi: string;
  };
  source: string;
  ee_project: string;
}

export interface EESiteStats {
  ndvi_mean: number;
  ndvi_stddev: number;
  ndwi_mean: number;
  ndwi_stddev: number;
  bsi_mean: number;
  bsi_stddev: number;
  scene_count: number;
  date_range: EEDateRange;
  source: string;
}

export interface EESceneInfo {
  target_date: string;
  scene_date: string;
  cloud_percentage: number;
  scene_id: string;
  tile_url: string;
}

export interface EECompareResult {
  before: EESceneInfo;
  after: EESceneInfo;
  vis_type: string;
  metrics: {
    ndvi_before?: number;
    ndvi_after?: number;
    ndvi_delta?: number;
    bsi_before?: number;
    bsi_after?: number;
    bsi_delta?: number;
    excavation_signal?: boolean;
    vegetation_loss_signal?: boolean;
  };
  source: string;
}

