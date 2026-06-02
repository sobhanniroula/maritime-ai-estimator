/**
 * marineWeather.ts
 *
 * This module fetches marine weather data for a given location.
 * It tries WeatherAPI.com first (requires a free API key).
 * If no key is set, it falls back to realistic estimated values
 * based on known Baltic Sea / Finnish coastal conditions.
 *
 * HOW IT WORKS:
 * 1. The AI calls this function via a "tool call" when it needs weather data
 * 2. We fetch from WeatherAPI and extract the key metrics
 * 3. Return a clean object the AI can reason about
 */

export interface MarineConditions {
  waveHeightMeters: number;
  windSpeedKph: number;
  windDirection: string;
  waterTempCelsius: number;
  condition: string;
  iceRisk: string;
  dataSource: string;
}

export async function getMarineConditions(
  lat: number,
  lng: number
): Promise<MarineConditions> {
  const apiKey = process.env.WEATHER_API_KEY;

  // Try live data from WeatherAPI.com if we have a key
  if (apiKey) {
    try {
      const url = `https://api.weatherapi.com/v1/marine.json?key=${apiKey}&q=${lat},${lng}&days=1`;
      const res = await fetch(url, { next: { revalidate: 3600 } }); // cache for 1 hour

      if (res.ok) {
        const data = await res.json();
        const current = data?.current;
        // Use midday forecast (index 12) for representative daytime conditions
        const noonForecast = data?.forecast?.forecastday?.[0]?.hour?.[12];

        return {
          // sig_ht_mt = significant wave height in metres (marine weather metric)
          waveHeightMeters: noonForecast?.sig_ht_mt ?? 0.5,
          windSpeedKph: current?.wind_kph ?? 12,
          windDirection: current?.wind_dir ?? "SW",
          waterTempCelsius: current?.temp_c ?? 8,
          condition: current?.condition?.text ?? "Partly cloudy",
          iceRisk: computeIceRisk(lat),
          dataSource: "WeatherAPI.com (live data)",
        };
      }
    } catch {
      // If the API call fails, fall through to estimates below
    }
  }

  // Fallback: realistic Baltic Sea / Finnish coastal estimates
  // These are based on typical seasonal averages for the region
  return {
    waveHeightMeters: lat > 60 ? 0.6 : 0.4, // Northern Baltic is slightly rougher
    windSpeedKph: lat > 62 ? 16 : 13,
    windDirection: "SW", // prevailing direction in Finland
    waterTempCelsius: lat > 65 ? 5 : lat > 60 ? 8 : 14,
    condition: "Partly cloudy",
    iceRisk: computeIceRisk(lat),
    dataSource: "Estimated (Baltic Sea seasonal averages)",
  };
}

/**
 * Compute ice risk category based on latitude.
 * In Finland, the further north you go, the longer and thicker the ice season.
 */
function computeIceRisk(lat: number): string {
  if (lat > 64) return "High — ice typically December–April, requires Arctic-grade system";
  if (lat > 60) return "Moderate — seasonal ice risk November–March, heavy pontoon required";
  if (lat > 57) return "Low-moderate — occasional thin ice, standard reinforcement needed";
  return "Low — ice rare, standard system suitable";
}
