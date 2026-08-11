export type RestaurantKey = "ADRENALINE" | "NUTRI_RESET";

export const RESTAURANTS = {
  ADRENALINE: {
    key: "ADRENALINE" as const,
    nameAr: "أدرينالين",
    nameEn: "Adrenaline",
    phone: "",
    menuPath: "/public/menu",
    reviewPath: "/public/order-review",
    logo: "/heart-logo.png",
    primary: "#3CC4F0",
    accent: "#0E76AC",
  },
  NUTRI_RESET: {
    key: "NUTRI_RESET" as const,
    nameAr: "نيوتري ريست",
    nameEn: "Nutri Reset",
    phone: "0097433546661",
    menuPath: "/nutri-reset/menu",
    reviewPath: "/nutri-reset/order-review",
    logo: "/nutri-reset-logo.png",
    primary: "#079AA5",
    accent: "#F47721",
  },
} as const;

export function isNutriResetHost(hostname?: string) {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : ""))
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return host === "nutrireset.online";
}

export function restaurantFromPath(pathname = window.location.pathname) {
  const queryRestaurant = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("restaurant")
    : null;
  return isNutriResetHost() || pathname.startsWith("/nutri-reset/") || queryRestaurant === "NUTRI_RESET"
    ? RESTAURANTS.NUTRI_RESET
    : RESTAURANTS.ADRENALINE;
}

export function restaurantKey(value: unknown): RestaurantKey {
  return value === "NUTRI_RESET" ? "NUTRI_RESET" : "ADRENALINE";
}
