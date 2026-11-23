import { useEffect, useState } from "react";
import { cars as fallbackCars } from "../data/cars";
import { api } from "./api";
import type { Car, SiteSettings } from "./types";

export const defaultSettings: SiteSettings = {
  businessName: "VAREON MOTORS",
  social: { instagram: "", facebook: "", youtube: "", tiktok: "", x: "", linkedin: "" },
  whatsapp: "",
  whatsappUrl: "",
  contact: { phone: "", email: "", address: "" },
  locations: ["Dubai — Downtown", "Abu Dhabi — Yas Island", "Doha — West Bay", "Riyadh — King Road"],
};

/**
 * Loads the live catalogue + site settings from the API.
 * The site paints immediately from the built-in catalogue and swaps to live data when it arrives;
 * if the API is unreachable the built-in data simply stays (nothing breaks).
 */
export function useShowroomData() {
  const [cars, setCars] = useState<Car[]>(fallbackCars);
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    Promise.allSettled([
      api.get<{ cars: Car[] }>("/cars", ac.signal),
      api.get<{ settings: SiteSettings }>("/settings", ac.signal),
    ]).then(([c, s]) => {
      if (ac.signal.aborted) return;
      if (c.status === "fulfilled" && Array.isArray(c.value.cars)) setCars(c.value.cars);
      if (s.status === "fulfilled" && s.value.settings) {
        setSettings({ ...defaultSettings, ...s.value.settings, social: { ...defaultSettings.social, ...s.value.settings.social } });
      }
      setLoaded(true);
    });
    return () => ac.abort();
  }, []);

  return { cars, settings, loaded };
}
