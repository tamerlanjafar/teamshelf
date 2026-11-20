/** "@Acme.com, example.org" → ["acme.com", "example.org"], or an error naming what isn't a domain. */
export function parseDomains(text: string): { domains: string[] } | { error: string } {
  const domains = [...new Set(text.split(/[\s,;]+/).map((part) => part.trim().toLowerCase().replace(/^@/, '')).filter(Boolean))]
  const bad = domains.find((domain) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain))
  if (bad) return { error: `“${bad}” isn't a domain. Write it like example.com.` }
  if (domains.length > 20) return { error: 'Use at most 20 domains.' }
  return { domains }
}
