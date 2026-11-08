import type { MetadataRoute } from 'next';

/** Εγκατάσταση στο κινητό («Προσθήκη στην αρχική οθόνη») — Admin → Mobile app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oramira',
    short_name: 'Oramira',
    description: 'Oramira — πωλήσεις, έργα, πελάτες.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F4EF',
    theme_color: '#1E3A2F',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
