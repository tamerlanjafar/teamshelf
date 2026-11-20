/** The icon the page at `address` declares: a web address, a `data:` copy of a small http image, or null. */
export function findIcon(address: string): Promise<string | null>
