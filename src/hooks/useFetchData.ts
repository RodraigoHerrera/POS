"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Fetches JSON from `url` on mount, exposing loading/error state and a
 * `reload` function to refetch (e.g. after a create/edit/delete).
 */
export function useFetchData<T>(url: string, initialValue: T) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Error ${res.status} al cargar ${url}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}
