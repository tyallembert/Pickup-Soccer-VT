const VT_VIEWBOX = "-73.5,42.7,-71.4,45.05"; // lng_min, lat_min, lng_max, lat_max
const VT_CENTER: [number, number] = [44.0, -72.7];

export type GeocodeResult = { lat: number; lng: number } | null;

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!address.trim()) return null;
  const params = new URLSearchParams({
    q: address,
    format: "json",
    countrycodes: "us",
    viewbox: VT_VIEWBOX,
    bounded: "1",
    limit: "1",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { "Accept-Language": "en-US,en;q=0.5" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export const VERMONT_CENTER = VT_CENTER;
