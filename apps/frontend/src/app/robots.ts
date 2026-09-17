import type { MetadataRoute } from "next";

// This is an authenticated operational SaaS, not a public marketing site —
// nothing here should be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
