import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required. Refusing to start with an unknown database deployment.");
}

export const convex = new ConvexReactClient(convexUrl);
