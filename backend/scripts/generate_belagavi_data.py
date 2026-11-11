import sys
import os
import json

sys.path.insert(0, os.path.abspath('backend'))
import ee

ee.Initialize(project='forensic-intelligence-511405')
from app.services.earth_engine import get_belagavi_boundary
from app.services.change_detection import generate_grid_tiles

print("Fetching Belagavi boundary from Earth Engine...")
boundary = get_belagavi_boundary()
print(f"Boundary retrieved: {boundary.get('type')}")

print("Generating 1 km grid tiles strictly clipped to Belagavi boundary...")
tiles = generate_grid_tiles(boundary, tile_size_m=1000)
print(f"Total clipped tiles inside Belagavi: {len(tiles)}")

def round_coords(coords):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 5), round(coords[1], 5)]
    return [round_coords(c) for c in coords]

features = []
for t in tiles:
    geom = dict(t['geometry'])
    geom['coordinates'] = round_coords(geom['coordinates'])
    features.append({
        'type': 'Feature',
        'id': t['tile_id'],
        'properties': {
            'tile_id': t['tile_id'],
            'tile_size_m': 1000,
            'area_km2': 1.0,
        },
        'geometry': geom,
    })

grid_fc = {
    'type': 'FeatureCollection',
    'total': len(features),
    'returned': len(features),
    'tile_size_m': 1000,
    'features': features,
}

grid_json = json.dumps(grid_fc, separators=(',', ':'))
print(f"Grid JSON size: {round(len(grid_json) / 1024 / 1024, 2)} MB")

boundary_feature = {
    'type': 'Feature',
    'properties': {
        'district': 'Belagavi',
        'district_alt': 'Belgaum',
        'state': 'Karnataka',
        'country': 'India',
        'total_area_km2': 13415,
        'grid_tile_count': len(features),
    },
    'geometry': {
        'type': boundary.get('type'),
        'coordinates': round_coords(boundary.get('coordinates', [])),
    },
}
boundary_fc = {
    'type': 'FeatureCollection',
    'features': [boundary_feature]
}
boundary_json = json.dumps(boundary_fc, separators=(',', ':'))

# Save to backend
os.makedirs('backend/app/data', exist_ok=True)
with open('backend/app/data/belagavi_1km_grid.json', 'w', encoding='utf-8') as f:
    f.write(grid_json)
with open('backend/app/data/belagavi_boundary.json', 'w', encoding='utf-8') as f:
    f.write(boundary_json)
print("Saved to backend/app/data/")

# Save to frontend public so client can load it instantly
os.makedirs('frontend/public/data', exist_ok=True)
with open('frontend/public/data/belagavi_1km_grid.json', 'w', encoding='utf-8') as f:
    f.write(grid_json)
with open('frontend/public/data/belagavi_boundary.json', 'w', encoding='utf-8') as f:
    f.write(boundary_json)
print("Saved to frontend/public/data/")

print("SUCCESS!")
