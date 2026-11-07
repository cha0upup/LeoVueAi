import { describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

const lint = new ESLint()
const rules = async (source, filePath) => (await lint.lintText(source, { filePath }))[0].messages.map(message => message.ruleId)

describe('Skill presentation/state architecture boundaries', () => {
  it.each(['SkillHealthDialog', 'SkillBatchResultDialog', 'SkillIssueDrawer', 'SkillCatalogTable', 'SkillCatalogFilters', 'SkillWorkspaceOverview'])('keeps %s free of API and controller imports', async (name) => {
    const messages = await rules('<script setup>import { listSkillsApi } from "@/services/api/skills.js"</script>',
      `src/components/SkillManager/${name}.vue`)
    expect(messages).toContain('no-restricted-imports')
  })

  it.each(['useSkillCatalog', 'useSkillWorkspace', 'useSkillBatchActions', 'useSkillFilters'])('keeps %s independent of Vue views', async (name) => {
    expect(await rules('import View from "./SkillHealthDialog.vue"', `src/components/SkillManager/${name}.js`))
      .toContain('no-restricted-imports')
  })

  it('still allows Vue state primitives and local pure view models', async () => {
    expect(await rules('import { ref } from "vue"; export const state = ref(null)', 'src/components/SkillManager/useSkillWorkspace.js'))
      .not.toContain('no-restricted-imports')
    expect(await rules('<script setup>import { issueTargetFile } from "./skillUiModel.js"</script>',
      'src/components/SkillManager/SkillIssueDrawer.vue')).not.toContain('no-restricted-imports')
  })

  it('keeps widget selection methods private to the catalog table', async () => {
    const source = '<script setup>const table = {}; table.clearSelection(); table.toggleRowSelection({}, true)</script>'
    expect((await rules(source, 'src/components/SkillManager/SkillManager.vue'))
      .filter(rule => rule === 'no-restricted-syntax')).toHaveLength(2)
    expect(await rules(source, 'src/components/SkillManager/SkillCatalogTable.vue'))
      .not.toContain('no-restricted-syntax')
  })

  it('keeps filter projections independent of transport and notification effects', async () => {
    expect(await rules('import { listSkillsApi } from "@/services/api/skills.js"',
      'src/components/SkillManager/useSkillFilters.js')).toContain('no-restricted-imports')
    expect(await rules('import { showError } from "@/utils/messageUtils.js"',
      'src/components/SkillManager/useSkillFilters.js')).toContain('no-restricted-imports')
  })
})
