/**
 * A name without its group's name in front: "Jenkins Retail" on the Jenkins card is "Retail".
 * The card already says the group, so a name doesn't repeat it. Only a whole word is taken
 * off ("Jenkinsfile" stays), and never the whole name.
 */
export function withoutGroupName(name: string, groupName: string): string {
  const text = name.trim()
  const group = groupName.trim()
  if (!group || !text.toLowerCase().startsWith(group.toLowerCase())) return text
  const rest = /^(?:\s+[-–—|:,]?|[–—|:,])\s*(.+)$/.exec(text.slice(group.length))?.[1].trim()
  return rest || text
}
