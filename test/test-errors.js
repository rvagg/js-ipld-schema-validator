/* eslint-env mocha */

import { create } from 'ipld-schema-validator'
import chai from 'chai'

const { assert } = chai

describe('Errors', () => {
  it('invalid schema definition', () => {
    // @ts-ignore
    assert.throws(() => create({}, 'blip'), /Invalid schema definition/)
  })

  it('no root', () => {
    // @ts-ignore
    assert.throws(() => create({ types: {} }), /A root is required/)
    // @ts-ignore
    assert.throws(() => create({ types: {} }, ''), /A root is required/)
    // @ts-ignore
    assert.throws(() => create({ types: {} }, null), /A root is required/)
    // @ts-ignore
    assert.throws(() => create({ types: {} }, 100), /A root is required/)
  })

  it('bad type kind', () => {
    assert.throws(() => create({
      types: {
        $map: {
          // @ts-ignore
          kind: 'blip',
          keyType: 'String',
          valueType: 'Int'
        }
      }
    }, '$map'), /type kind: "blip"/)
  })

  it('recursive map kind', () => {
    assert.throws(() => create({
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
    assert.throws(() => create({
      types: {
        $list: {
          kind: 'list',
          valueType: '$list'
        }
      }
    }, '$list'), /Recursive typedef in type "\$list"/)
  })

  it('invalid map keyType', () => {
    assert.throws(() => create({
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
    assert.throws(() => create({
      types: {
        $list: {
          kind: 'list',
          valueType: 'String'
        }
      }
    }, 'blip'), /A type must match an existing type definition \("blip"\)/)
  })

  it('invalid reference', () => {
    assert.throws(() => create({
      types: {
        $list: {
          kind: 'list',
          valueType: 'boop'
        }
      }
    }, '$list'), /A type must match an existing type definition \("boop"\)/)
  })

  it('bad valueType', () => {
    assert.throws(() => create({
      types: {
        AMap: {
          kind: 'map',
          keyType: 'String',
          // @ts-ignore
          valueType: [],
          representation: { map: {} }
        }
      }
    }, 'AMap'), /Bad type for "valueType" in "AMap"/)

    assert.throws(() => create({
      types: {
        AList: {
          kind: 'list',
          // @ts-ignore
          valueType: true
        }
      }
    }, 'AList'), /Bad type for "valueType" in "AList"/)
  })

  it('bad map representation', () => {
    assert.throws(() => create({
      types: {
        AMap: {
          kind: 'map',
          keyType: 'String',
          valueType: 'String',
          // @ts-ignore
          representation: { blip: {} }
        }
      }
    }, 'AMap'), /Unsupported map representation "blip"/)
  })

  it('bad struct representation', () => {
    assert.throws(() => create({
      types: {
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int', optional: true },
            bar: { type: 'Bool' },
            baz: { type: 'String', optional: true }
          },
          // @ts-ignore
          representation: { blip: {} }
        }
      }
    }, 'SimpleStruct'), /Unsupported struct representation for "SimpleStruct": "blip"/)
  })

  it('non-map struct with optionals', () => {
    assert.throws(() => create({
      types: {
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int', optional: true },
            bar: { type: 'Bool' },
            baz: { type: 'String', optional: true }
          },
          representation: { tuple: {} }
        }
      }
    }, 'SimpleStruct'), /Struct "SimpleStruct" includes "optional" fields for non-map struct/)
  })

  it('bad union', () => {
    assert.throws(() => create({
      types: {
        // @ts-ignore
        UnionUnknown: {
          kind: 'union'
        }
      }
    }, 'UnionUnknown'), /Bad union definition for "UnionUnknown"/)
  })

  it('bad envelope union', () => {
    assert.throws(() => create({
      types: {
        UnionInline: {
          kind: 'union',
          representation: {
            // @ts-ignore
            inline: {
              discriminantKey: 'tag'
            }
          }
        },
        Foo: {
          kind: 'struct',
          fields: {
            froz: { type: 'Bool' }
          },
          representation: { map: {} }
        },
        Bar: {
          kind: 'struct',
          fields: {
            bral: { type: 'String' }
          },
          representation: { map: {} }
        }
      }
    }, 'UnionInline'), /Expected "discriminantTable" for inline union "UnionInline"/)

    assert.throws(() => create({
      types: {
        UnionInline: {
          kind: 'union',
          representation: {
            // @ts-ignore
            inline: {
              discriminantTable: {
                foo: 'Foo',
                bar: 'Bar'
              }
            }
          }
        },
        Foo: {
          kind: 'struct',
          fields: {
            froz: { type: 'Bool' }
          },
          representation: { map: {} }
        },
        Bar: {
          kind: 'struct',
          fields: {
            bral: { type: 'String' }
          },
          representation: { map: {} }
        }
      }
    }, 'UnionInline'), /Expected "discriminantKey" for inline union "UnionInline"/)
  })

  it('bad envelope union', () => {
    assert.throws(() => create({
      types: {
        Bar: { kind: 'bool' },
        Baz: { kind: 'string' },
        Foo: { kind: 'int' },
        UnionEnvelope: {
          kind: 'union',
          representation: {
            // @ts-ignore
            envelope: {
              discriminantKey: 'bim',
              contentKey: 'bam'
            }
          }
        }
      }
    }, 'UnionEnvelope'), /Expected "discriminantTable" for envelope union "UnionEnvelope"/)

    assert.throws(() => create({
      types: {
        Bar: { kind: 'bool' },
        Baz: { kind: 'string' },
        Foo: { kind: 'int' },
        UnionEnvelope: {
          kind: 'union',
          representation: {
            // @ts-ignore
            envelope: {
              contentKey: 'bim',
              discriminantTable: {
                foo: 'Foo',
                bar: 'Bar',
                baz: 'Baz'
              }
            }
          }
        }
      }
    }, 'UnionEnvelope'), /Expected "discriminantKey" for envelope union "UnionEnvelope"/)

    assert.throws(() => create({
      types: {
        Bar: { kind: 'bool' },
        Baz: { kind: 'string' },
        Foo: { kind: 'int' },
        UnionEnvelope: {
          kind: 'union',
          representation: {
            // @ts-ignore
            envelope: {
              discriminantKey: 'bim',
              discriminantTable: {
                foo: 'Foo',
                bar: 'Bar',
                baz: 'Baz'
              }
            }
          }
        }
      }
    }, 'UnionEnvelope'), /Expected "contentKey" for envelope union "UnionEnvelope"/)
  })

  it('bad union type name', () => {
    assert.throws(() => create({
      types: {
        Bar: { kind: 'bool' },
        Baz: { kind: 'string' },
        Foo: { kind: 'int' },
        UnionKinded: {
          kind: 'union',
          representation: {
            kinded: {
              map: 'Foo',
              list: 'Bar',
              // @ts-ignore
              int: {}
            }
          }
        }
      }
    }, 'UnionKinded'), /Kinded union "UnionKinded refers to non-string type name: {}/)

    // @ts-ignore
    assert.throws(() => create({
      types: {
        UnionKeyed: {
          kind: 'union',
          representation: {
            // @ts-ignore
            keyed: {
              bar: 'Bool',
              foo: 'Int',
              // @ts-ignore
              baz: ['nope']
            }
          }
        }
      }
    }, 'UnionKeyed'), /Keyed union "UnionKeyed refers to non-string type name: \["nope"\]/)

    assert.throws(() => create({
      types: {
        UnionInline: {
          kind: 'union',
          representation: {
            inline: {
              discriminantKey: 'tag',
              // @ts-ignore
              discriminantTable: {
                foo: 'Foo',
                // @ts-ignore
                bar: 100
              }
            }
          }
        },
        Foo: {
          kind: 'struct',
          fields: {
            froz: { type: 'Bool' }
          },
          representation: { map: {} }
        },
        Bar: {
          kind: 'struct',
          fields: {
            bral: { type: 'String' }
          },
          representation: { map: {} }
        }
      }
    }, 'UnionInline'), /Inline union "UnionInline refers to non-string type name: 100/)

    assert.throws(() => create({
      types: {
        Bar: { kind: 'bool' },
        Baz: { kind: 'string' },
        Foo: { kind: 'int' },
        UnionEnvelope: {
          kind: 'union',
          representation: {
            envelope: {
              discriminantKey: 'bim',
              contentKey: 'bam',
              discriminantTable: {
                foo: 'Foo',
                // @ts-ignore
                bar: true,
                baz: 'Baz'
              }
            }
          }
        }
      }
    }, 'UnionEnvelope'), /Envelope union "UnionEnvelope refers to non-string type name: true/)
  })

  it('bad byteprefix byte', () => {
    assert.throws(() => create({
      types: {
        Bls12_381Signature: { kind: 'bytes' },
        Secp256k1Signature: { kind: 'bytes' },
        Signature: {
          kind: 'union',
          representation: {
            byteprefix: {
              Secp256k1Signature: 0,
              Bls12_381Signature: -1
            }
          }
        }
      }
    }, 'Signature'), /Invalid byteprefix byte for "Signature": "-1"/)
  })

  it('bad union type', () => {
    assert.throws(() => create({
      types: {
        UnionKeyed: {
          kind: 'union',
          representation: {
            // @ts-ignore
            blip: { }
          }
        }
      }
    }, 'UnionKeyed'), /Unsupported union type for "UnionKeyed": "blip"/)
  })

  it('bad enum descriptor', () => {
    assert.throws(() => create({
      types: {
        // @ts-ignore
        SimpleEnum: {
          kind: 'enum'
        }
      }
    }, 'SimpleEnum'), /Enum needs a "members" list/)
  })

  it('bad string enum rename values', () => {
    assert.throws(() => create({
      types: {
        SimpleEnum: {
          kind: 'enum',
          members: {
            Foo: null,
            Bar: null,
            Baz: null
          },
          representation: {
            string: {
              Foo: 'str',
              // @ts-ignore
              Bar: 0
            }
          }
        }
      }
    }, 'SimpleEnum'), /Enum members must be strings/)
  })

  it('bad int enum rename values', () => {
    assert.throws(() => create({
      types: {
        SimpleEnum: {
          kind: 'enum',
          members: {
            Foo: null,
            Bar: null,
            Baz: null
          },
          representation: {
            int: {
              // @ts-ignore
              Foo: 'str',
              Bar: 0
            }
          }
        }
      }
    }, 'SimpleEnum'), /Enum members must be ints/)
  })

  it('no enum representation', () => {
    assert.throws(() => create({
      types: {
        // @ts-ignore
        SimpleEnum: {
          kind: 'enum',
          members: {
            Foo: null,
            Bar: null,
            Baz: null
          }
        }
      }
    }, 'SimpleEnum'), /Enum doesn't have a valid representation/)
  })

  it('bad enum representation type', () => {
    assert.throws(() => create({
      types: {
        SimpleEnum: {
          kind: 'enum',
          members: {
            Foo: null,
            Bar: null,
            Baz: null
          },
          representation: {
            // @ts-ignore
            nope: {}
          }
        }
      }
    }, 'SimpleEnum'), /Enum doesn't have a valid representation/)
  })
})
