/** The icon the page at `address` declares: a web address, a `data:` copy of a small http image, or null. */
export function findIcon(address: string): Promise<string | null>
/** Whether this IP address is one the lookup must never connect to. Anything that isn't an IP address counts as one. */
export function isPrivateAddress(address: string): boolean
