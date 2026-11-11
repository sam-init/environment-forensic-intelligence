import { useState, useEffect, useRef } from 'react';

export interface LocationInfo {
  area: string;
  district: string;
  state: string;
  country: string;
  formatted: string;
  loading: boolean;
}

/**
 * Coordinate-based local fallback dictionary for Belagavi District, Karnataka.
 * Ensures instant display without network lag or if offline.
 */
function getRegionalFallback(lon: number, lat: number): {
  area: string;
  district: string;
  state: string;
  country: string;
} {
  // Belagavi District approximate bounding box: lon 74.0 to 75.5, lat 15.3 to 16.9
  if (lon >= 74.0 && lon <= 75.5 && lat >= 15.3 && lat <= 16.9) {
    let area = 'Belagavi Region';

    if (lat >= 16.6 && lon >= 74.9) {
      area = 'Athani Taluk';
    } else if (lat >= 16.4 && lon >= 74.7) {
      area = 'Raybag Taluk';
    } else if (lat >= 16.3 && lon < 74.8) {
      area = 'Chikkodi Taluk';
    } else if (lat >= 16.15 && lon < 74.7) {
      area = 'Hukkeri Taluk';
    } else if (lat >= 16.1 && lon >= 74.7) {
      area = 'Gokak Taluk';
    } else if (lat >= 15.85 && lon >= 75.15) {
      area = 'Ramdurg Taluk';
    } else if (lat >= 15.7 && lat < 16.0 && lon >= 75.0) {
      area = 'Saundatti Taluk';
    } else if (lat >= 15.7 && lat < 16.0 && lon >= 74.7) {
      area = 'Bailhongal Taluk';
    } else if (lat <= 15.7) {
      area = 'Khanapur Taluk';
    } else {
      area = 'Belagavi City & Taluk';
    }

    return {
      area,
      district: 'Belagavi District',
      state: 'Karnataka',
      country: 'India',
    };
  }

  // Broad southern India coordinates fallback
  if (lon >= 73.0 && lon <= 78.5 && lat >= 11.5 && lat <= 18.5) {
    return {
      area: 'Regional Sector',
      district: 'Belagavi Division',
      state: 'Karnataka',
      country: 'India',
    };
  }

  return {
    area: 'Area View',
    district: 'Belagavi District',
    state: 'Karnataka',
    country: 'India',
  };
}

export function useLocationInfo(center?: [number, number] | null): LocationInfo {
  const [info, setInfo] = useState<LocationInfo>(() => {
    const lon = center?.[0] ?? 74.5;
    const lat = center?.[1] ?? 15.85;
    const fb = getRegionalFallback(lon, lat);
    return {
      area: fb.area,
      district: fb.district,
      state: fb.state,
      country: fb.country,
      formatted: `${fb.area} · ${fb.district} · ${fb.state}`,
      loading: false,
    };
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!center) return;
    const [lon, lat] = center;

    // 1. Immediately apply fast regional fallback
    const fb = getRegionalFallback(lon, lat);
    setInfo((prev) => ({
      ...prev,
      area: fb.area,
      district: fb.district,
      state: fb.state,
      country: fb.country,
      formatted: `${fb.area} · ${fb.district} · ${fb.state}`,
      loading: true,
    }));

    // 2. Query reverse-geocoding service with debouncing
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Reverse geocode failed');
        const data = await res.json();
        const feat = data?.features?.[0];

        if (feat?.properties) {
          const p = feat.properties;
          
          // Resolve area name (city / locality / town / village)
          let resolvedArea = p.city || p.locality || p.suburb || p.district;
          if (!resolvedArea && p.name && !['building', 'house'].includes((p.type ?? '').toLowerCase())) {
            resolvedArea = p.name;
          }
          if (!resolvedArea) {
            resolvedArea = fb.area;
          }

          // Resolve district name
          let resolvedDistrict = fb.district;
          if (p.county && p.county.toLowerCase().includes('district')) {
            resolvedDistrict = p.county;
          } else if (p.district && p.district.toLowerCase().includes('district')) {
            resolvedDistrict = p.district;
          } else if (p.county) {
            resolvedDistrict = `${p.county.replace(/taluk|taluku/i, '').trim()} District`;
          }

          const resolvedState = p.state || fb.state || 'Karnataka';
          const resolvedCountry = p.country || fb.country || 'India';

          setInfo({
            area: resolvedArea,
            district: resolvedDistrict,
            state: resolvedState,
            country: resolvedCountry,
            formatted: `${resolvedArea} · ${resolvedDistrict} · ${resolvedState}`,
            loading: false,
          });
        } else {
          setInfo((prev) => ({ ...prev, loading: false }));
        }
      } catch {
        if (!controller.signal.aborted) {
          setInfo((prev) => ({ ...prev, loading: false }));
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [center?.[0], center?.[1]]);

  return info;
}
