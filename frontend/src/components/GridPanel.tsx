/**
 * GridPanel — builds and displays Belagavi's fixed 1 km × 1 km review grid.
 * A grid cell is a processing/review unit, not a detected incident.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Grid3x3, MapPin, RefreshCw, X } from 'lucide-react';
import { api } from '../utils/api';
import type { GridGenerateResponse, GridTileCollection } from '../types/api';

const TILE_SIZE_M = 1000;
const TILE_LIMIT = 50_000;

interface GridPanelProps {
  onTilesLoaded: (tiles: GridTileCollection | null) => void;
  onFocus: () => void;
  selectedTileId: string | null;
  onClearSelection: () => void;
}

export function GridPanel({
  onTilesLoaded,
  onFocus,
  selectedTileId,
  onClearSelection,
}: GridPanelProps) {
  const [summary, setSummary] = useState<GridGenerateResponse | null>(null);

  const {
    data: tiles,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<GridTileCollection>({
    queryKey: ['belagavi-grid', TILE_SIZE_M],
    queryFn: async () => {
      const r = await api.get<GridTileCollection>('/change-detection/tiles', {
        params: { tile_size_m: TILE_SIZE_M, limit: TILE_LIMIT },
        timeout: 120_000,
      });
      return r.data;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    onTilesLoaded(tiles ?? null);
  }, [tiles, onTilesLoaded]);

  const generateMutation = useMutation<GridGenerateResponse, Error, void>({
    mutationFn: async () => {
      const r = await api.post<GridGenerateResponse>(
        '/change-detection/tiles/generate',
        { tile_size_m: TILE_SIZE_M },
        { timeout: 300_000 },
      );
      return r.data;
    },
    onSuccess: async (result) => {
      setSummary(result);
      await refetch();
      onFocus();
    },
  });

  const busy = generateMutation.isPending || isFetching;

  return (
    <div className="grid-panel">
      <div className="ee-panel-header">
        <Grid3x3 size={14} style={{ color: '#22d3ee' }} />
        <span className="ee-panel-title">Grid Analysis</span>
        <button
          className="btn btn-ghost"
          style={{ marginLeft: 'auto', padding: '2px 4px' }}
          onClick={() => refetch()}
          title="Refresh stored tiles"
          disabled={busy}
        >
          <RefreshCw size={10} />
        </button>
      </div>

      <div className="ee-layer-label">TARGET REGION</div>
      <div className="grid-region">
        <MapPin size={12} style={{ color: '#22d3ee' }} />
        <span>Belagavi, Karnataka</span>
      </div>

      <div className="grid-meta-row">
        <span>Cell size</span>
        <strong>1 × 1 km</strong>
      </div>
      <div className="grid-meta-row">
        <span>Tiles stored</span>
        <strong>{isLoading ? '…' : (tiles?.total ?? 0).toLocaleString()}</strong>
      </div>
      {tiles && tiles.returned < tiles.total && (
        <div className="grid-meta-row grid-meta-muted">
          <span>Rendered</span>
          <span>{tiles.returned.toLocaleString()} of {tiles.total.toLocaleString()}</span>
        </div>
      )}

      <button
        className="btn btn-primary grid-generate-btn"
        onClick={() => generateMutation.mutate()}
        disabled={busy}
      >
        {generateMutation.isPending ? (
          <>
            <div className="loading-spinner" style={{ width: 10, height: 10, borderWidth: 1 }} />
            Generating 1 km grid…
          </>
        ) : (
          <>
            <Grid3x3 size={12} /> Generate 1 km Grid
          </>
        )}
      </button>

      {summary && (
        <div className="grid-summary">
          {summary.inserted.toLocaleString()} new · {summary.tile_count.toLocaleString()} total cells
        </div>
      )}
      {generateMutation.isError && (
        <div className="grid-error">{generateMutation.error.message}</div>
      )}

      {selectedTileId && (
        <div className="grid-selected">
          <div>
            <span className="grid-selected-label">SELECTED CELL</span>
            <div className="grid-selected-id">{selectedTileId}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClearSelection} title="Clear selection">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="grid-hint">
        Each 1 km cell is a review unit for imagery and model inspection. A cell is not an incident.
      </div>
    </div>
  );
}
