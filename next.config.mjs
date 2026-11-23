/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Σελίδες που μόλις επισκεφθήκατε ανοίγουν αμέσως (30″), χωρίς νέα φόρτωση.
    staleTimes: { dynamic: 30, static: 180 },
    serverActions: {
      bodySizeLimit: '10mb', // accommodate document/photo uploads via server actions
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
