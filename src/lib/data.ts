import { useEffect, useState } from 'react';

export interface Loaded<T> {
  data?: T;
  error?: string;
}

/** Fetches a JSON file from public/data. The only I/O the app performs. */
export function useJson<T>(path: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({});
  useEffect(() => {
    let alive = true;
    setState({});
    fetch(`${import.meta.env.BASE_URL}data/${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} for data/${path}`);
        return r.json() as Promise<T>;
      })
      .then((data) => alive && setState({ data }))
      .catch((e: unknown) => alive && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}
