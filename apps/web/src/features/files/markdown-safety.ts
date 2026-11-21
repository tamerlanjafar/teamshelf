// Whether a Markdown document can be opened in the editor. Pure functions, no React.
//
// Markdown may carry HTML: a tag in the middle of a sentence, or a whole block of it. The editor
// is never given any. A document that has some is read and edited as plain text instead, where
// a tag is only the characters it is written with. So no tag, attribute or address from a file
// ever reaches the part of the editor that understands HTML.

import { marked, type Token } from 'marked'

function hasHtml(tokens: Token[]): boolean {
  return tokens.some((token) => {
    if (token.type === 'html') return true
    const inner = [...('tokens' in token && token.tokens ? token.tokens : []), ...('items' in token ? (token.items as Token[]) : [])]
    if (token.type === 'table') {
      const cells = [...token.header, ...token.rows.flat()] as { tokens: Token[] }[]
      return cells.some((cell) => hasHtml(cell.tokens))
    }
    return hasHtml(inner)
  })
}

/**
 * True for a document that must be shown as it is written: it has HTML in it, or it can't be
 * read as Markdown at all. Code (in backticks, or a fenced block) is not HTML: it is shown as code.
 */
export function needsPlainText(markdown: string): boolean {
  try {
    return hasHtml(marked.lexer(markdown))
  } catch {
    return true
  }
}
