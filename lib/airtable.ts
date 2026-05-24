async function fetchTable(table: string, params: Record<string, string> = {}, noCache = false) {
  const allRecords: any[] = []
  let offset: string | undefined

  do {
    const url = new URL(`${API_URL}/${encodeURIComponent(table)}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
      ...(noCache ? { cache: 'no-store' } : { next: { revalidate: 3600 } }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Airtable [${table}] ${res.status}: ${err}`)
    }

    const data = await res.json()
    allRecords.push(...(data.records || []))
    offset = data.offset
  } while (offset)

  return { records: allRecords }
}
