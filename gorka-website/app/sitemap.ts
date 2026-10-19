import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.gorka.click'
  const locales = ['en', 'es']
  const routes = ['', '/pricing', '/faq', '/login', '/register', '/download', '/contact']

  const sitemapEntries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const route of routes) {
      sitemapEntries.push({
        url: baseUrl + '/' + locale + route,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      })
    }
  }

  return sitemapEntries
}