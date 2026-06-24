import { useState, useCallback, useRef } from 'react';

export default function useLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const locationsCache = useRef(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      locationsCache.current = data;
      setLocations(data);
    } catch (err) {
      console.error('Lokasyonlar yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addLocation = useCallback(async (location) => {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
    });
    const data = await res.json();
    await fetchLocations();
    return data;
  }, [fetchLocations]);

  const deleteLocation = useCallback(async (id) => {
    await fetch(`/api/locations/${id}`, { method: 'DELETE' });
    await fetchLocations();
  }, [fetchLocations]);

  return { locations, loading, fetchLocations, addLocation, deleteLocation };
}

export function useConnections() {
  const [connections, setConnections] = useState([]);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/connections');
      const data = await res.json();
      setConnections(data);
      return data;
    } catch (err) {
      console.error('Bağlantılar yüklenemedi:', err);
      return [];
    }
  }, []);

  const addConnection = useCallback(
    async (source_location_id, destination_location_id) => {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_location_id, destination_location_id }),
      });
      const data = await res.json();
      await fetchConnections();
      return data;
    },
    [fetchConnections]
  );

  const deleteConnection = useCallback(
    async (id) => {
      await fetch(`/api/connections/${id}`, { method: 'DELETE' });
      await fetchConnections();
    },
    [fetchConnections]
  );

  return { connections, fetchConnections, addConnection, deleteConnection };
}
