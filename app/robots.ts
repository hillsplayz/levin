import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: ['ClaudeBot', 'Claude-User', 'Claude-SearchBot'],
        allow: '/',
        disallow: '/api/',
      },
    ],
  }
}
