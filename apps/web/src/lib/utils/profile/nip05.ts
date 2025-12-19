export async function verifyNip05(nip05: string, pubkey: string): Promise<boolean> {
  try {
    const match = nip05.match(/^([^@]+)@(.+)$/)
    if (!match) return false

    const [, name, domain] = match
    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false

    const data = await res.json()
    const expectedPubkey = data?.names?.[name]

    return expectedPubkey === pubkey
  } catch {
    return false
  }
}
