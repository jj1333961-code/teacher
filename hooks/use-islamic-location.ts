"use client"

import { useCallback, useEffect, useState } from "react"
import { FALLBACK_LOCATION } from "@/lib/islamic/prayer"

export type LocationState = {
  lat: number
  lon: number
  isFallback: boolean
  status: "loading" | "ready" | "denied" | "unsupported"
}

export function useIslamicLocation() {
  const [state, setState] = useState<LocationState>({
    lat: FALLBACK_LOCATION.lat,
    lon: FALLBACK_LOCATION.lon,
    isFallback: true,
    status: "loading",
  })

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unsupported", isFallback: true }))
      return
    }
    setState((s) => ({ ...s, status: "loading" }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          isFallback: false,
          status: "ready",
        })
      },
      () => {
        setState({
          lat: FALLBACK_LOCATION.lat,
          lon: FALLBACK_LOCATION.lon,
          isFallback: true,
          status: "denied",
        })
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 },
    )
  }, [])

  useEffect(() => {
    request()
  }, [request])

  return { ...state, retry: request }
}
