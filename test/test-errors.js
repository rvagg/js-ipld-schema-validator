/* eslint-env mocha */

import SchemaValidate from 'ipld-schema-validate'
import chai from 'chai'

const { assert } = chai

describe('Errors', () => {
  it('invalid schema definition', () => {
    assert.throws(() => SchemaValidate.create({}, 'blip'), /Invalid schema definition/)
  })

  it('no root', () => {
    assert.throws(() => SchemaValidate.create({ types: {} }), /A root is required/)
    assert.throws(() => SchemaValidate.create({ types: {} }, ''), /A root is required/)
    assert.throws(() => SchemaValidate.create({ types: {} }, null), /A root is required/)
    assert.throws(() => SchemaValidate.create({ types: {} }, 100), /A root is required/)
  })

  it('bad type kind', () => {
    assert.throws(() => SchemaValidate.create({
      types: {
        $map: {
          kind: 'blip',
          keyType: 'String',
          valueType: 'Int'
        }
      }
    }, '$map'), /type kind: "blip"/)
  })

  it('recursive map kind', () => {
    assert.throws(() => SchemaValidate.create({
      types: {
        $map: {
          kind: 'map',
          keyType: 'String',
          valueType: '$map'
        }
      }
    }, '$map'), /Recursive typedef in type "\$map"/)
  })

  it('recursive list kind', () => {
    assert.throws(() => SchemaValidate.create({
      types: {
        $list: {
          kind: 'list',
          valueType: '$list'
        }
      }
    }, '$list'), /Recursive typedef in type "\$list"/)
  })

  it('invalid map keyType', () => {
    assert.throws(() => SchemaValidate.create({
      types: {
        $map: {
          kind: 'map',
          keyType: 'Bytes',
          valueType: 'Int'
        }
      }
    }, '$map'), /Invalid keyType for Map "\$map", expected String, found "Bytes"/)
  })

  it('invalid root', () => {
    assert.throws(() => SchemaValidate.create({
      types: {
        $list: {
          kind: 'list',
          valueType: 'String'
        }
      }
    }, 'blip'), /A type must match an existing type definition \("blip"\)/)
  })

  it('invalid reference', () => {
    assert.throws(() => SchemaValidate.create({
      types: {
        $list: {
          kind: 'list',
          valueType: 'boop'
        }
      }
    }, '$list'), /A type must match an existing type definition \("boop"\)/)
  })
})
