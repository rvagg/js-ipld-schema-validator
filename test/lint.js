import chai from 'chai'
// @ts-ignore
import standard from 'standard'

/**
 * @param {import('ipld-schema-validator').ValidatorFunction} validator
 */
export async function lint (validator) {
  if (standard) { // not in browser
    const fn = validator.toString()
      .replace(/^/gm, '  ')
      .replace(/^ {2}function anonymous\(obj\n {2}\) \{/, 'function validatorLintForm (obj) {')
      .replace(/ {2}\}$/, '}')
    const [result] = await standard.lintText(`${fn}\nvalidatorLintForm('')\n`)
    if (result) {
      for (const message of result.messages) {
        console.error(
          '%d:%d: %s%s%s',
          message.line || 0,
          message.column || 0,
          message.message,
          ' (' + message.ruleId + ')',
          message.severity === 1 ? ' (warning)' : ''
        )
      }
      if (result.messages.length) {
        chai.assert.fail(`Failed to lint validator function:\n${fn}`)
      }
    }
  }
}
