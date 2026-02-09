export type LocationResult = {
  label: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: "gps" | "network";
};

export async function getDeviceLocation(): Promise<LocationResult> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("Geolocation is not supported on this device."));
  }

  if (!window.isSecureContext && window.location.hostname !== "localhost") {
    return Promise.reject(new Error("Location requires HTTPS. Please use a secure connection."));
  }

  try {
    const position = await getPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0
    });
    return formatPosition(position);
  } catch (error) {
    if (isRetryableError(error)) {
      try {
        const watchPosition = await getPositionWithWatch({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        });
        return formatPosition(watchPosition);
      } catch (watchError) {
        if (isRetryableError(watchError)) {
          try {
            const fallbackPosition = await getPosition({
              enableHighAccuracy: false,
              timeout: 20000,
              maximumAge: 60000
            });
            return formatPosition(fallbackPosition);
          } catch (fallbackError) {
            throw mapGeoError(fallbackError);
          }
        }
        throw mapGeoError(watchError);
      }
    }
    throw mapGeoError(error);
  }
}

function getPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function getPositionWithWatch(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        navigator.geolocation.clearWatch(watchId);
        resolve(position);
      },
      (error) => {
        navigator.geolocation.clearWatch(watchId);
        reject(error);
      },
      options
    );
  });
}

function formatPosition(position: GeolocationPosition): LocationResult {
  const { latitude, longitude, accuracy } = position.coords;
  const lat = latitude.toFixed(5);
  const lng = longitude.toFixed(5);
  const acc = Math.round(accuracy);
  return {
    label: `GPS ${lat}, ${lng} (+/-${acc}m)`,
    latitude,
    longitude,
    accuracy: acc,
    source: "gps"
  };
}

function isRetryableError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      ("code" in error || "message" in error) &&
      (error as GeolocationPositionError).code !== GeolocationPositionError.PERMISSION_DENIED
  );
}

function mapGeoError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as GeolocationPositionError).code;
    switch (code) {
      case GeolocationPositionError.PERMISSION_DENIED:
        return new Error("Location permission denied. Please allow location access and retry.");
      case GeolocationPositionError.POSITION_UNAVAILABLE:
        return new Error("Location is unavailable. Check your device GPS and try again.");
      case GeolocationPositionError.TIMEOUT:
        return new Error("Location request timed out. Try again in a few seconds.");
      default:
        return new Error("Unable to fetch location.");
    }
  }
  return new Error("Unable to fetch location.");
}
