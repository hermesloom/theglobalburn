/**
 * Gets location information from an IP address using ip-api.com (free, open source)
 * @param ipAddress The IP address to look up
 * @returns Location information or null if lookup fails
 */
export async function getLocationFromIP(ipAddress: string): Promise<{
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
} | null> {
  // Skip localhost and private IPs
  if (
    ipAddress === "127.0.0.1" ||
    ipAddress === "::1" ||
    ipAddress.startsWith("192.168.") ||
    ipAddress.startsWith("10.") ||
    ipAddress.startsWith("172.16.") ||
    ipAddress.startsWith("172.17.") ||
    ipAddress.startsWith("172.18.") ||
    ipAddress.startsWith("172.19.") ||
    ipAddress.startsWith("172.20.") ||
    ipAddress.startsWith("172.21.") ||
    ipAddress.startsWith("172.22.") ||
    ipAddress.startsWith("172.23.") ||
    ipAddress.startsWith("172.24.") ||
    ipAddress.startsWith("172.25.") ||
    ipAddress.startsWith("172.26.") ||
    ipAddress.startsWith("172.27.") ||
    ipAddress.startsWith("172.28.") ||
    ipAddress.startsWith("172.29.") ||
    ipAddress.startsWith("172.30.") ||
    ipAddress.startsWith("172.31.")
  ) {
    return null;
  }

  try {
    // Using ip-api.com free tier (no API key required, 45 requests/minute)
    const response = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,message,country,regionName,city,lat,lon`,
      {
        headers: {
          "User-Agent": "TheBorderland/1.0",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status === "fail") {
      return null;
    }

    return {
      country: data.country || null,
      region: data.regionName || null,
      city: data.city || null,
      latitude: data.lat || null,
      longitude: data.lon || null,
    };
  } catch (error) {
    console.error("Error fetching location from IP:", error);
    return null;
  }
}
