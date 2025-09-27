function extractUrls(html: string): Set<string> {
  const set = new Set<string>()
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.querySelectorAll("a[href]").forEach((a) => {
    try {
      set.add(new URL((a as HTMLAnchorElement).href).href)
    } catch {}
  })
  return set
}

function stripNewUrls(originalHtml: string, newHtml: string, allowDomains: string[]): string {
  const before = extractUrls(originalHtml)
  const doc = new DOMParser().parseFromString(newHtml, "text/html")
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = (a as HTMLAnchorElement).href
    let ok = before.has(href)
    if (!ok) {
      try {
        const u = new URL(href)
        ok = allowDomains.some((dom) => u.hostname === dom || u.hostname.endsWith(`.${dom}`))
      } catch {}
    }
    if (!ok) {
      const span = doc.createTextNode((a as HTMLAnchorElement).textContent || "")
      a.replaceWith(span) // unwrap link, keep text
    }
  })
  return doc.body.innerHTML
}
