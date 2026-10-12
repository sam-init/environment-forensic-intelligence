import React, { useState, useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { Search, X, MapPin, Loader2 } from 'lucide-react';

export interface CityLocation {
  name: string;
  stateCountry: string;
  coordinates: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  aliases?: string[];
}

// Curated instant lookup database for zero-latency, offline-capable search
const CURATED_CITIES: CityLocation[] = [
  // ── Karnataka Major Cities & Districts ──
  { name: 'Bengaluru', stateCountry: 'Karnataka, India', coordinates: [77.5946, 12.9716], aliases: ['Bangalore', 'Bangaluru'] },
  { name: 'Mysuru', stateCountry: 'Karnataka, India', coordinates: [76.6394, 12.2958], aliases: ['Mysore'] },
  { name: 'Mangaluru', stateCountry: 'Karnataka, India', coordinates: [74.856, 12.9141], aliases: ['Mangalore'] },
  { name: 'Hubballi-Dharwad', stateCountry: 'Karnataka, India', coordinates: [75.124, 15.3647], aliases: ['Hubli', 'Dharwad', 'Hubli-Dharwad'] },
  { name: 'Belagavi', stateCountry: 'Karnataka, India', coordinates: [74.5089, 15.8497], aliases: ['Belgaum'] },
  { name: 'Kalaburagi', stateCountry: 'Karnataka, India', coordinates: [76.8343, 17.3297], aliases: ['Gulbarga'] },
  { name: 'Shivamogga', stateCountry: 'Karnataka, India', coordinates: [75.5681, 13.9299], aliases: ['Shimoga'] },
  { name: 'Ballari', stateCountry: 'Karnataka, India', coordinates: [76.9214, 15.1394], aliases: ['Bellary'] },
  { name: 'Vijayapura', stateCountry: 'Karnataka, India', coordinates: [75.7139, 16.8302], aliases: ['Bijapur'] },
  { name: 'Tumakuru', stateCountry: 'Karnataka, India', coordinates: [77.1009, 13.3409], aliases: ['Tumkur'] },
  { name: 'Davanagere', stateCountry: 'Karnataka, India', coordinates: [75.9218, 14.4644], aliases: ['Davangere'] },
  { name: 'Bidar', stateCountry: 'Karnataka, India', coordinates: [77.5199, 17.9104] },
  { name: 'Raichur', stateCountry: 'Karnataka, India', coordinates: [77.3556, 16.2076] },
  { name: 'Udupi', stateCountry: 'Karnataka, India', coordinates: [74.7421, 13.3409], aliases: ['Udipi'] },
  { name: 'Hassan', stateCountry: 'Karnataka, India', coordinates: [76.0963, 13.0072] },
  { name: 'Chitradurga', stateCountry: 'Karnataka, India', coordinates: [76.4022, 14.2251] },
  { name: 'Kolar', stateCountry: 'Karnataka, India', coordinates: [78.134, 13.1367] },
  { name: 'Mandya', stateCountry: 'Karnataka, India', coordinates: [76.8958, 12.5244] },
  { name: 'Chikkamagaluru', stateCountry: 'Karnataka, India', coordinates: [75.772, 13.3161], aliases: ['Chikmagalur'] },
  { name: 'Bagalkot', stateCountry: 'Karnataka, India', coordinates: [75.6615, 16.1875] },
  { name: 'Gadag', stateCountry: 'Karnataka, India', coordinates: [75.6267, 15.4314] },
  { name: 'Haveri', stateCountry: 'Karnataka, India', coordinates: [75.4055, 14.7954] },
  { name: 'Yadgir', stateCountry: 'Karnataka, India', coordinates: [77.1378, 16.7697] },
  { name: 'Ramanagara', stateCountry: 'Karnataka, India', coordinates: [77.281, 12.7209] },
  { name: 'Chamarajanagar', stateCountry: 'Karnataka, India', coordinates: [76.9429, 11.9261] },
  { name: 'Koppal', stateCountry: 'Karnataka, India', coordinates: [76.155, 15.3556] },
  { name: 'Karwar', stateCountry: 'Karnataka, India', coordinates: [74.1303, 14.8136] },
  { name: 'Madikeri', stateCountry: 'Karnataka, India', coordinates: [75.7382, 12.4244], aliases: ['Coorg'] },
  { name: 'Sirsi', stateCountry: 'Karnataka, India', coordinates: [74.8354, 14.6195] },
  { name: 'Dandeli', stateCountry: 'Karnataka, India', coordinates: [74.623, 15.2427] },
  { name: 'Gokarna', stateCountry: 'Karnataka, India', coordinates: [74.3188, 14.5436] },
  { name: 'Hampi', stateCountry: 'Karnataka, India', coordinates: [76.46, 15.335] },

  // ── Indian Metros & Capitals ──
  { name: 'New Delhi', stateCountry: 'Delhi, India', coordinates: [77.209, 28.6139], aliases: ['Delhi', 'NCR'] },
  { name: 'Mumbai', stateCountry: 'Maharashtra, India', coordinates: [72.8777, 19.076], aliases: ['Bombay'] },
  { name: 'Chennai', stateCountry: 'Tamil Nadu, India', coordinates: [80.2707, 13.0827], aliases: ['Madras'] },
  { name: 'Kolkata', stateCountry: 'West Bengal, India', coordinates: [88.3639, 22.5726], aliases: ['Calcutta'] },
  { name: 'Hyderabad', stateCountry: 'Telangana, India', coordinates: [78.4867, 17.385] },
  { name: 'Pune', stateCountry: 'Maharashtra, India', coordinates: [73.8567, 18.5204] },
  { name: 'Ahmedabad', stateCountry: 'Gujarat, India', coordinates: [72.5714, 23.0225] },
  { name: 'Jaipur', stateCountry: 'Rajasthan, India', coordinates: [75.7873, 26.9124] },
  { name: 'Lucknow', stateCountry: 'Uttar Pradesh, India', coordinates: [80.9462, 26.8467] },
  { name: 'Chandigarh', stateCountry: 'Punjab & Haryana, India', coordinates: [76.7794, 30.7333] },
  { name: 'Bhopal', stateCountry: 'Madhya Pradesh, India', coordinates: [77.4126, 23.2599] },
  { name: 'Kochi', stateCountry: 'Kerala, India', coordinates: [76.2673, 9.9312], aliases: ['Cochin'] },
  { name: 'Thiruvananthapuram', stateCountry: 'Kerala, India', coordinates: [76.9366, 8.5241], aliases: ['Trivandrum'] },
  { name: 'Visakhapatnam', stateCountry: 'Andhra Pradesh, India', coordinates: [83.2185, 17.6868], aliases: ['Vizag'] },
  { name: 'Patna', stateCountry: 'Bihar, India', coordinates: [85.1376, 25.5941] },
  { name: 'Bhubaneswar', stateCountry: 'Odisha, India', coordinates: [85.8245, 20.2961] },
  { name: 'Guwahati', stateCountry: 'Assam, India', coordinates: [91.7362, 26.1445] },
  { name: 'Srinagar', stateCountry: 'Jammu & Kashmir, India', coordinates: [74.7973, 34.0837] },
  { name: 'Panaji', stateCountry: 'Goa, India', coordinates: [73.8278, 15.4909], aliases: ['Goa'] },
  { name: 'Surat', stateCountry: 'Gujarat, India', coordinates: [72.8311, 21.1702] },
  { name: 'Indore', stateCountry: 'Madhya Pradesh, India', coordinates: [75.8577, 22.7196] },
  { name: 'Nagpur', stateCountry: 'Maharashtra, India', coordinates: [79.0882, 21.1458] },
  { name: 'Coimbatore', stateCountry: 'Tamil Nadu, India', coordinates: [76.9558, 11.0168] },
  { name: 'Dehradun', stateCountry: 'Uttarakhand, India', coordinates: [78.0322, 30.3165] },
  { name: 'Shimla', stateCountry: 'Himachal Pradesh, India', coordinates: [77.1734, 31.1048] },
  { name: 'Ranchi', stateCountry: 'Jharkhand, India', coordinates: [85.3096, 23.3441] },
  { name: 'Raipur', stateCountry: 'Chhattisgarh, India', coordinates: [81.6296, 21.2514] },
  { name: 'Amritsar', stateCountry: 'Punjab, India', coordinates: [74.8765, 31.634] },
  { name: 'Varanasi', stateCountry: 'Uttar Pradesh, India', coordinates: [82.9739, 25.3176], aliases: ['Banaras', 'Kashi'] },
  { name: 'Agra', stateCountry: 'Uttar Pradesh, India', coordinates: [78.0081, 27.1767] },

  // ── Global Hubs ──
  { name: 'London', stateCountry: 'United Kingdom', coordinates: [-0.1276, 51.5074] },
  { name: 'New York', stateCountry: 'United States', coordinates: [-74.006, 40.7128], aliases: ['NYC'] },
  { name: 'Tokyo', stateCountry: 'Japan', coordinates: [139.6917, 35.6895] },
  { name: 'Singapore', stateCountry: 'Singapore', coordinates: [103.8198, 1.3521] },
  { name: 'Dubai', stateCountry: 'United Arab Emirates', coordinates: [55.2708, 25.2048] },
  { name: 'Paris', stateCountry: 'France', coordinates: [2.3522, 48.8566] },
  { name: 'Sydney', stateCountry: 'Australia', coordinates: [151.2093, -33.8688] },
  { name: 'Berlin', stateCountry: 'Germany', coordinates: [13.405, 52.52] },
  { name: 'San Francisco', stateCountry: 'United States', coordinates: [-122.4194, 37.7749] },
];

interface CitySearchBarProps {
  map: maplibregl.Map | null;
  isPanelOpen?: boolean;
}

export function CitySearchBar({ map, isPanelOpen = false }: CitySearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [remoteResults, setRemoteResults] = useState<CityLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter curated cities immediately based on input
  const localResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    return CURATED_CITIES.filter((city) => {
      if (city.name.toLowerCase().includes(trimmed)) return true;
      if (city.stateCountry.toLowerCase().includes(trimmed)) return true;
      if (city.aliases?.some((a) => a.toLowerCase().includes(trimmed))) return true;
      return false;
    }).slice(0, 6);
  }, [query]);

  // Combine local and remote results (deduplicating by name)
  const combinedResults = useMemo(() => {
    const seenNames = new Set<string>();
    const list: CityLocation[] = [];

    localResults.forEach((city) => {
      seenNames.add(city.name.toLowerCase());
      list.push(city);
    });

    remoteResults.forEach((city) => {
      if (!seenNames.has(city.name.toLowerCase())) {
        seenNames.add(city.name.toLowerCase());
        list.push(city);
      }
    });

    return list.slice(0, 8);
  }, [localResults, remoteResults]);

  // Query OpenStreetMap Nominatim for geocoding with debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setRemoteResults([]);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          trimmed
        )}&limit=5&addressdetails=1&accept-language=en`;

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!res.ok) throw new Error('Geocoding request failed');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any[] = await res.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed: CityLocation[] = data.map((item: any) => {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const parts = (item.display_name as string).split(',').map((s) => s.trim());
          const name = parts[0] || trimmed;
          const stateCountry = parts.slice(1, 3).join(', ') || parts.slice(1).join(', ');

          let bbox: [number, number, number, number] | undefined;
          if (item.boundingbox && item.boundingbox.length === 4) {
            bbox = [
              parseFloat(item.boundingbox[2]), // minLng
              parseFloat(item.boundingbox[0]), // minLat
              parseFloat(item.boundingbox[3]), // maxLng
              parseFloat(item.boundingbox[1]), // maxLat
            ];
          }

          return {
            name,
            stateCountry,
            coordinates: [lon, lat],
            bbox,
          };
        });

        setRemoteResults(parsed);
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') {
          setRemoteResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up search marker on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  // Format coordinates cleanly
  const formatCoords = (coords: [number, number]) => {
    const lng = coords[0];
    const lat = coords[1];
    const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
    const lngStr = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
    return `${latStr}, ${lngStr}`;
  };

  // Navigate map to city and place glowing beacon
  const handleSelectCity = (city: CityLocation) => {
    setQuery(city.name);
    setIsOpen(false);
    setSelectedIndex(-1);

    if (!map) return;

    // Fly smoothly to location
    if (city.bbox) {
      map.fitBounds(
        [
          [city.bbox[0], city.bbox[1]],
          [city.bbox[2], city.bbox[3]],
        ],
        {
          padding: 80,
          maxZoom: 13,
          duration: 1600,
          essential: true,
        }
      );
    } else {
      map.flyTo({
        center: city.coordinates,
        zoom: 12,
        duration: 1600,
        essential: true,
      });
    }

    // Clean up previous marker
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Create stylish animated target pin
    const pinEl = document.createElement('div');
    pinEl.className = 'map-search-beacon';
    pinEl.innerHTML = `
      <div class="beacon-pulse"></div>
      <div class="beacon-center"></div>
    `;

    const popupContent = `
      <div style="font-family: var(--font-sans, sans-serif); padding: 2px 4px; color: #e8eaf0;">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px; color: #fff;">${city.name}</div>
        <div style="font-size: 11px; color: #8b94a8; margin-bottom: 6px;">${city.stateCountry}</div>
        <div style="font-family: var(--font-mono, monospace); font-size: 10px; color: #3b7fff; background: rgba(59,127,255,0.12); padding: 2px 6px; border-radius: 4px; display: inline-block;">
          ${formatCoords(city.coordinates)}
        </div>
      </div>
    `;

    const popup = new maplibregl.Popup({
      offset: 14,
      closeButton: true,
      className: 'map-search-popup',
    }).setHTML(popupContent);

    const marker = new maplibregl.Marker({ element: pinEl })
      .setLngLat(city.coordinates)
      .setPopup(popup)
      .addTo(map);

    popup.addTo(map);
    markerRef.current = marker;
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < combinedResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : combinedResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < combinedResults.length) {
        handleSelectCity(combinedResults[selectedIndex]);
      } else if (combinedResults.length > 0) {
        handleSelectCity(combinedResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleClear = () => {
    setQuery('');
    setRemoteResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={`city-search-container ${isPanelOpen ? 'panel-offset' : ''}`}
      aria-label="City Search on Map"
    >
      <div className="city-search-bar">
        <Search size={15} className="city-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="city-search-input"
          value={query}
          placeholder="Search city (e.g. Bengaluru, Mumbai, Delhi)..."
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (query.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {isLoading && <Loader2 size={14} className="city-search-loading" />}
        {query && !isLoading && (
          <button
            type="button"
            className="city-search-clear-btn"
            onClick={handleClear}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && query.trim().length > 0 && (
        <div className="city-search-dropdown" role="listbox">
          {combinedResults.length === 0 ? (
            <div className="city-search-empty">
              {isLoading ? 'Searching locations…' : `No locations found for "${query}"`}
            </div>
          ) : (
            combinedResults.map((city, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${city.name}-${city.coordinates.join(',')}-${idx}`}
                  className={`city-search-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectCity(city)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="city-search-item-info">
                    <div className="city-search-item-name">
                      <MapPin size={13} className="city-search-pin-icon" />
                      <span>{city.name}</span>
                    </div>
                    <div className="city-search-item-region">{city.stateCountry}</div>
                  </div>
                  <div className="city-search-item-coords">
                    {formatCoords(city.coordinates)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
