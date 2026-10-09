import { useEffect, useState } from "react";

export function useGeolocation() {
  const [status, setStatus] = useState("pending");
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("granted");
      },
      () => {
        setStatus("denied");
      },
      { timeout: 8000 }
    );
  }, []);

  return { status, coords };
}
