import { createRenderer } from 'vue'

// A minimal in-memory host for lifecycle tests, without a browser dependency.
export function createTestRenderer() {
  const node = (type, text = '') => ({ type, text, children: [], props: {}, parent: null })
  const remove = child => {
    if (!child.parent) return
    const siblings = child.parent.children
    siblings.splice(siblings.indexOf(child), 1)
    child.parent = null
  }
  const renderer = createRenderer({
    createElement: type => node(type),
    createText: text => node('text', text),
    createComment: text => node('comment', text),
    setText: (target, text) => { target.text = text },
    setElementText: (target, text) => {
      for (const child of target.children) child.parent = null
      target.children = []
      target.text = text
    },
    patchProp: (target, key, previous, value) => { target.props[key] = value },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
    remove,
    insert: (child, parent, anchor = null) => {
      remove(child)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index >= 0 ? index : parent.children.length, 0, child)
      child.parent = parent
    }
  })
  return { ...renderer, root: node('root') }
}
