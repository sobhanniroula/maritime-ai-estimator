import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Leaflet is incompatible with React Strict Mode's intentional double-mount in dev.
  // Strict Mode mounts → unmounts → remounts every component to catch side-effect bugs.
  // Leaflet marks the DOM node with _leaflet_id on first mount; the remount finds the
  // node already tagged and throws "Map container is already initialized".
  // Disabling strictMode here only affects the dev server, production builds are fine.
  reactStrictMode: false,

  images: {
    domains: [],
  },
};

export default nextConfig;
