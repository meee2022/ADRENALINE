import { ConvexReactClient } from "convex/react";

const convexUrl = "https://rightful-parakeet-660.convex.cloud";
console.log("Convex URL:", convexUrl);

export const convex = new ConvexReactClient(convexUrl);
