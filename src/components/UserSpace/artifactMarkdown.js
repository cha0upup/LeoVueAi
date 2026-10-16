import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const markdown = new Marked({ gfm: true, breaks: false })
const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'strong', 'em', 'del',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  ALLOWED_ATTR: ['href', 'title', 'align', 'start'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false
}

export function renderArtifactMarkdown(content) {
  // Archived documents are passive content: no scripts, controls or remote resource loading.
  return DOMPurify.sanitize(markdown.parse(String(content ?? ''), { async: false }), SANITIZE_OPTIONS)
}
