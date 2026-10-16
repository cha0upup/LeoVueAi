import { describe, expect, it, vi } from 'vitest'
import DOMPurify from 'dompurify'
import { renderArtifactMarkdown } from './artifactMarkdown.js'

vi.mock('dompurify', () => ({ default: { sanitize: vi.fn(html => html) } }))

describe('artifactMarkdown', () => {
  it('renders report headings, lists, tables and escaped code before sanitizing', () => {
    const html = renderArtifactMarkdown('# Report\n\n- **Finding**\n\n| Key | Value |\n| --- | --- |\n| A | B |\n\n```html\n<script>example</script>\n```')
    for (const fragment of ['<h1>Report</h1>', '<ul>', '<strong>Finding</strong>', '<table>', '&lt;script&gt;example&lt;/script&gt;']) expect(html).toContain(fragment)
  })

  it('returns sanitizer output and restricts documents to passive markup', () => {
    DOMPurify.sanitize.mockReturnValueOnce('sanitized')
    expect(renderArtifactMarkdown('<script>alert(1)</script>')).toBe('sanitized')
    const options = DOMPurify.sanitize.mock.lastCall[1]
    for (const tag of ['script', 'img', 'iframe', 'style', 'form', 'input', 'button']) expect(options.ALLOWED_TAGS).not.toContain(tag)
    expect(options.ALLOWED_ATTR).toEqual(['href', 'title', 'align', 'start'])
    expect(options.ALLOW_DATA_ATTR).toBe(false)
  })
})
