/* eslint-disable no-new-func */

/**
 * @typedef {import('ipld-schema/schema-schema').EnumMember} EnumMember
 * @typedef {import('ipld-schema/schema-schema').KindInt} KindInt
 * @typedef {import('ipld-schema/schema-schema').KindString} KindString
 * @typedef {import('ipld-schema/schema-schema').Schema} Schema
 * @typedef {import('ipld-schema/schema-schema').TypeDefn} TypeDefn
 * @typedef {import('ipld-schema/schema-schema').InlineDefn} InlineDefn
 * @typedef {import('ipld-schema/schema-schema').TypeName} TypeName
 * @typedef {import('ipld-schema/schema-schema').TypeNameOrInlineDefn} TypeNameOrInlineDefn
 * @typedef {(obj:any)=>boolean} ValidatorFunction
 */

const safeNameRe = /^\$?[a-z][a-z0-9]+$/i

/**
 * @param {string} name
 * @returns {string}
 */
export function safeReference (name) {
  return safeNameRe.test(name) ? `.${name}` : `['${name}']`
}

/**
 * @param {string[]|number[]} list
 * @returns {string}
 */
function fromArray (list) {
  return JSON.stringify(list).replace(/"/g, '\'').replace(/,/g, ', ')
}

const KindsDefn =
`const Kinds = {
  Null: /** @returns {boolean} */ (/** @type {any} */ obj) => obj === null,
  Int: /** @returns {boolean} */ (/** @type {any} */ obj) => Number.isInteger(obj),
  Float: /** @returns {boolean} */ (/** @type {any} */ obj) => typeof obj === 'number' && Number.isFinite(obj),
  String: /** @returns {boolean} */ (/** @type {any} */ obj) => typeof obj === 'string',
  Bool: /** @returns {boolean} */ (/** @type {any} */ obj) => typeof obj === 'boolean',
  Bytes: /** @returns {boolean} */ (/** @type {any} */ obj) => obj instanceof Uint8Array,
  Link: /** @returns {boolean} */ (/** @type {any} */ obj) => !Kinds.Null(obj) && typeof obj === 'object' && obj.asCID === obj,
  List: /** @returns {boolean} */ (/** @type {any} */ obj) => Array.isArray(obj),
  Map: /** @returns {boolean} */ (/** @type {any} */ obj) => !Kinds.Null(obj) && typeof obj === 'object' && obj.asCID !== obj && !Kinds.List(obj) && !Kinds.Bytes(obj)
}`

const ScalarKindNames = ['Null', 'Int', 'Float', 'String', 'Bool', 'Bytes', 'Link']
const ScalarKindNamesLower = ScalarKindNames.map((n) => n.toLowerCase())
// const TypeKindNames = ['string', 'bool', 'bytes', 'int', 'float', 'map', 'list', 'link', 'union', 'struct', 'enum', 'copy']

/** @type {{ [ k in string]: TypeDefn }} */
const implicits = {
  Null: /** @type {TypeDefnNull} */ { null: {} },
  Int: /** @type {TypeDefnInt} */ { int: {} },
  Float: /** @type {TypeDefnFloat} */ { float: {} },
  String: /** @type {TypeDefnString} */ { string: {} },
  Bool: /** @type {TypeDefnBool} */ { bool: {} },
  Bytes: /** @type {TypeDefnBytes} */ { bytes: {} },
  Link: /** @type {TypeDefnLink} */ { link: {} }
}

implicits.AnyScalar = /** @type {TypeDefnUnion} */ {
  union: {
    members: [
      'Bool',
      'String',
      'Bytes',
      'Int',
      'Float'
    ],
    representation: {
      kinded: {
        bool: 'Bool',
        string: 'String',
        bytes: 'Bytes',
        int: 'Int',
        float: 'Float'
      }
    }
  }
}
implicits.AnyMap = /** @type {TypeDefnMap} */ {
  map: {
    keyType: 'String',
    valueType: 'Any'
  }
}
implicits.AnyList = /** @type {TypeDefnList} */ {
  list: {
    valueType: 'Any'
  }
}
implicits.Any = /** @type {TypeDefnUnion} */ {
  union: {
    members: [
      'Bool',
      'String',
      'Bytes',
      'Int',
      'Float',
      'Null',
      'Link',
      'AnyMap',
      'AnyList'
    ],
    representation: {
      kinded: {
        bool: 'Bool',
        string: 'String',
        bytes: 'Bytes',
        int: 'Int',
        float: 'Float',
        null: 'Null',
        link: 'Link',
        map: 'AnyMap',
        list: 'AnyList'
      }
    }
  }
}

/**
 * @param {string} s
 * @returns {string}
 */
function tc (s) {
  return s.charAt(0).toUpperCase() + s.substring(1)
}

/**
 * @param {Schema} schema
 * @param {string} root
 * @returns {ValidatorFunction}
 */
export function create (schema, root) {
  if (!root || typeof root !== 'string') {
    throw new TypeError('A root is required')
  }

  const builder = new Builder(schema)
  builder.addType(root)

  let fn = builder.dumpValidators()
  fn += `return Types${safeReference(root)}(obj)`
  // console.log(fn)

  return /** @type {ValidatorFunction} */ (new Function('obj', fn))
}

export class Builder {
  /**
   * @param {Schema} schema
   */
  constructor (schema) {
    if (!schema || typeof schema.types !== 'object') {
      throw new TypeError('Invalid schema definition')
    }

    // new schema with implicits
    this.schema = {
      types: Object.assign({}, implicits, schema.types)
    }

    /** @type {Record<string, string>} */
    this.typeValidators = {}
  }

  dumpValidators () {
    const objKey = (/** @type {string} */ name) => {
      return safeNameRe.test(name) ? name : `'${name}'`
    }
    const fn = `${KindsDefn}\n` +
      '/** @type {{ [k in string]: (obj:any)=>boolean}} */\n' +
      `const Types = {\n${Object.entries(this.typeValidators).map(([name, fn]) => `  ${objKey(name)}: ${fn}`).join(',\n')}\n}\n`
    return fn
  }

  /**
   * @param {TypeName} typeName
   * @param {TypeDefn} [typeDef]
   * @returns {void}
   */
  addType (typeName, typeDef) {
    if (this.typeValidators[typeName]) { // already added this one
      return
    }

    if (typeName === 'Any') {
      // special case for Any because it's a recursive definition, so we set up a dummy in place so
      // any recursive attempt to add finds a definition before it's set
      this.typeValidators[typeName] = '() => false'
    }

    if (typeDef === undefined && typeName in this.schema.types && this.schema.types[typeName] !== undefined) {
      typeDef = this.schema.types[typeName]
    }
    if (typeDef === undefined) {
      throw new TypeError(`A type must match an existing type definition ("${typeName}")`)
    }
    if (Array.isArray(typeDef) || typeDef == null || typeof typeDef !== 'object') {
      throw new TypeError(`Malformed type definition: not an object: ("${typeName}")`)
    }

    const kind = typeKind(typeDef, typeName)

    if (ScalarKindNamesLower.includes(kind)) {
      this.typeValidators[typeName] = `Kinds.${tc(kind)}`
      return
    }

    /**
     * @param {TypeNameOrInlineDefn} defType
     * @param {TypeName} name
     * @returns {string}
     */
    const defineType = (defType, name) => {
      if (defType === typeName) {
        throw new Error(`Recursive typedef in type "${typeName}"`)
      }
      let innerTypeName = defType
      if (typeof innerTypeName === 'string') {
        this.addType(innerTypeName)
      } else if (defType != null && !Array.isArray(defType) && typeof defType === 'object') { // anonymous inline map or list!
        typeKind(defType, name) // called for check
        innerTypeName = `${typeName} > ${name} (anon)`
        this.addType(innerTypeName, defType)
      } else {
        throw new Error(`Bad type for "${name}" in "${typeName}"`)
      }
      return innerTypeName
    }

    if ('list' in typeDef) {
      const valueTypeName = defineType(typeDef.list.valueType, 'valueType')
      let valueValidator = `Types${safeReference(valueTypeName)}`
      if (typeDef.list.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }
      this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => Kinds.List(obj) && Array.prototype.every.call(obj, ${valueValidator})`

      return
    }

    if ('map' in typeDef) {
      if (typeDef.map.keyType !== 'String') {
        throw new Error(`Invalid keyType for Map "${typeName}", expected String, found "${typeDef.map.keyType}"`)
      }

      let representation = 'map'
      if (typeDef.map.representation !== undefined) {
        if ('listpairs' in typeDef.map.representation && typeof typeDef.map.representation.listpairs === 'object') {
          representation = 'listpairs'
        } else if (!('map' in typeDef.map.representation) || typeof typeDef.map.representation.map !== 'object') {
          throw new Error(`Unsupported map representation "${Object.keys(typeDef.map.representation).join(',')}"`)
        }
      }

      const valueTypeName = defineType(typeDef.map.valueType, 'valueType')
      let valueValidator = `Types${safeReference(valueTypeName)}`
      if (typeDef.map.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }

      if (representation === 'listpairs') {
        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => Kinds.List(obj) && Array.prototype.every.call(obj, (e) => Kinds.List(e) && e.length === 2 && Kinds.String(e[0]) && (${valueValidator})(e[1]))`
        return
      }

      this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => Kinds.Map(obj) && Array.prototype.every.call(Object.values(obj), ${valueValidator})`

      return
    }

    if ('struct' in typeDef) {
      let representation = 'map'
      if (typeDef.struct.representation !== undefined) {
        if ('tuple' in typeDef.struct.representation && typeof typeDef.struct.representation.tuple === 'object') {
          representation = 'tuple'
        } else if (!('map' in typeDef.struct.representation) || typeof typeDef.struct.representation.map !== 'object') {
          throw new Error(`Unsupported struct representation for "${typeName}": "${Object.keys(typeDef.struct.representation).join(',')}"`)
        }
      }

      let requiredFields = []
      for (let [fieldName, fieldDef] of Object.entries(typeDef.struct.fields)) {
        let required = representation !== 'map' || fieldDef.optional !== true

        if (typeDef.struct.representation !== undefined &&
            'map' in typeDef.struct.representation &&
            typeof typeDef.struct.representation.map === 'object' &&
            typeof typeDef.struct.representation.map.fields === 'object' &&
            typeof typeDef.struct.representation.map.fields[fieldName] === 'object') {
          if (typeDef.struct.representation.map.fields[fieldName].implicit !== undefined) {
            required = false
          }
          const fieldDef = typeDef.struct.representation.map.fields[fieldName]
          if (typeof fieldDef.rename === 'string') {
            fieldName = fieldDef.rename
          }
        }

        const fieldKey = `${typeName} > ${fieldName}`
        if (required) {
          requiredFields.push(fieldName)
        }
        if (representation !== 'map' && fieldDef.optional === true) {
          throw new Error(`Struct "${typeName}" includes "optional" fields for non-map struct`)
        }
        const fieldTypeName = defineType(fieldDef.type, fieldName)
        let fieldValidator = `Types${safeReference(fieldTypeName)}(obj)`
        if (fieldDef.nullable === true) {
          fieldValidator = `obj === null || ${fieldValidator}`
        }
        this.typeValidators[fieldKey] = `/** @returns {boolean} */ (/** @type {any} */ obj) => ${fieldValidator}`
      }

      if (representation === 'tuple') {
        if (typeDef.struct.representation &&
            'tuple' in typeDef.struct.representation &&
            Array.isArray(typeDef.struct.representation.tuple.fieldOrder)) {
          requiredFields = typeDef.struct.representation.tuple.fieldOrder
        }
        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => Kinds.List(obj) && obj.length === ${requiredFields.length}${requiredFields.map((fieldName, i) => ` && Types['${typeName} > ${fieldName}'](obj[${i}])`).join('')}`
      } else {
        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => { const keys = obj && Object.keys(obj); return Kinds.Map(obj) && ${fromArray(requiredFields)}.every((k) => keys.includes(k)) && Object.entries(obj).every(([name, value]) => Types['${typeName} > ' + name] && Types['${typeName} > ' + name](value)) }`
      }

      return
    }

    if ('union' in typeDef) {
      if (typeof typeDef.union.representation !== 'object') {
        throw new Error(`Bad union definition for "${typeName}"`)
      }

      if ('keyed' in typeDef.union.representation && typeof typeDef.union.representation.keyed === 'object') {
        const keys = typeDef.union.representation.keyed
        const validators = Object.entries(keys).map(([key, innerTypeName]) => {
          if (typeof innerTypeName !== 'string') {
            throw new Error(`Keyed union "${typeName} refers to non-string type name: ${JSON.stringify(innerTypeName)}`)
          }
          this.addType(innerTypeName)
          const validator = `Types${safeReference(innerTypeName)}`
          return `(keys[0] === '${key}' && ${validator}(obj${safeReference(key)}))`
        })
        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => { const keys = obj && Object.keys(obj); return Kinds.Map(obj) && keys.length === 1 && ${fromArray(Object.keys(keys))}.includes(keys[0]) && (${validators.join(' || ')}) }`

        return
      }

      if ('kinded' in typeDef.union.representation && typeof typeDef.union.representation.kinded === 'object') {
        const kinds = typeDef.union.representation.kinded
        const validators = Object.entries(kinds).map(([kind, innerTypeName]) => {
          if (typeof innerTypeName === 'object' && 'link' in innerTypeName && typeof innerTypeName.link === 'object') {
            const defn = innerTypeName
            const et = 'expectedType' in innerTypeName.link ? innerTypeName.link.expectedType : 'Any'
            innerTypeName = `${typeName} > ${et} (anon)`
            this.addType(innerTypeName, defn)
          }
          if (typeof innerTypeName !== 'string') {
            throw new Error(`Kinded union "${typeName} refers to non-string type name: ${JSON.stringify(innerTypeName)}`)
          }
          this.addType(innerTypeName)
          // the Kinds.X(obj) prefix here results in a double-check in practice once we go into Types["Y"],
          // because we should be able to presume that the type in question will do a kind check of its own.
          // _But_, it makes sure that a broken schema that uses a bad kind discriminator will properly fail
          // instead of erroneously passing
          return `(Kinds.${tc(kind)}(obj) && Types${safeReference(innerTypeName)}(obj))`
        })
        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => ${validators.join(' || ')}`

        return
      }

      if ('inline' in typeDef.union.representation && typeof typeDef.union.representation.inline === 'object') {
        const inline = typeDef.union.representation.inline
        if (typeof inline.discriminantKey !== 'string') {
          throw new Error(`Expected "discriminantKey" for inline union "${typeName}"`)
        }
        if (typeof inline.discriminantTable !== 'object') {
          throw new Error(`Expected "discriminantTable" for inline union "${typeName}"`)
        }
        const validators = Object.entries(inline.discriminantTable).map(([key, innerTypeName]) => {
          if (typeof innerTypeName !== 'string') {
            throw new Error(`Inline union "${typeName} refers to non-string type name: ${JSON.stringify(innerTypeName)}`)
          }
          this.addType(innerTypeName)
          return `(key === '${key}' && Types${safeReference(innerTypeName)}(obj))`
        })
        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => { const key = obj && obj${safeReference(inline.discriminantKey)}; if (!Kinds.Map(obj) || !Kinds.String(key)) { return false }; obj = Object.assign({}, obj); delete obj${safeReference(inline.discriminantKey)}; return ${validators.join(' || ')} }`

        return
      }

      if ('envelope' in typeDef.union.representation && typeof typeDef.union.representation.envelope === 'object') {
        const envelope = typeDef.union.representation.envelope
        if (typeof envelope.discriminantKey !== 'string') {
          throw new Error(`Expected "discriminantKey" for envelope union "${typeName}"`)
        }
        if (typeof envelope.contentKey !== 'string') {
          throw new Error(`Expected "contentKey" for envelope union "${typeName}"`)
        }
        if (typeof envelope.discriminantTable !== 'object') {
          throw new Error(`Expected "discriminantTable" for envelope union "${typeName}"`)
        }
        const validators = Object.entries(envelope.discriminantTable).map(([key, innerTypeName]) => {
          if (typeof innerTypeName !== 'string') {
            throw new Error(`Envelope union "${typeName} refers to non-string type name: ${JSON.stringify(innerTypeName)}`)
          }
          this.addType(innerTypeName)
          return `(key === '${key}' && Types${safeReference(innerTypeName)}(content))`
        })
        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => { const key = obj && obj${safeReference(envelope.discriminantKey)}; const content = obj && obj${safeReference(envelope.contentKey)}; return Kinds.Map(obj) && Kinds.String(key) && content !== undefined && (${validators.join(' || ')}) }`

        return
      }

      if ('bytesprefix' in typeDef.union.representation && typeof typeDef.union.representation.bytesprefix === 'object') {
        /** @type {number[]} */
        const bytes = Object.values(typeDef.union.representation.bytesprefix).map((byte) => {
          if (typeof byte !== 'string' || !/^[0-9a-f][0-9a-f]?$/.test(byte)) {
            throw new Error(`Invalid bytesprefix byte for "${typeName}": "${byte}"`)
          }
          return parseInt(byte, 16)
        })

        this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => { return Kinds.Bytes(obj) && obj.length >= 1 && ${fromArray(bytes)}.includes(obj[0]) }`

        return
      }

      throw new Error(`Unsupported union type for "${typeName}": "${Object.keys(typeDef.union.representation).join(',')}"`)
    }

    if ('enum' in typeDef) {
      if (!Array.isArray(typeDef.enum.members)) {
        throw new Error('Enum needs a "members" list')
      }
      /** @type {string[]|number[]}} */
      let values
      let representation = 'string'
      if (typeof typeDef.enum.representation === 'object') {
        if ('string' in typeDef.enum.representation && typeof typeDef.enum.representation.string === 'object') {
          const renames = typeDef.enum.representation.string
          values = typeDef.enum.members.map((v) => {
            v = renames[v] !== undefined ? renames[v] : v
            if (typeof v !== 'string') {
              throw new Error('Enum members must be strings')
            }
            return v
          })
        } else if ('int' in typeDef.enum.representation && typeof typeDef.enum.representation.int === 'object') {
          const renames = typeDef.enum.representation.int
          values = typeDef.enum.members.map((v) => {
            if (renames[v] === undefined || typeof renames[v] !== 'number' || !Number.isInteger(renames[v])) {
              throw new Error('Enum members must be ints')
            }
            return renames[v]
          })
          representation = 'int'
        } else {
          throw new Error('Enum doesn\'t have a valid representation')
        }
      } else {
        throw new Error('Enum doesn\'t have a valid representation')
      }
      this.typeValidators[typeName] = `/** @returns {boolean} */ (/** @type {any} */ obj) => Kinds.${tc(representation)}(obj) && ${fromArray(values)}.includes(obj)`

      return
    }

    throw new Error(`Can't deal with type kind: "${kind}"`)
  }
}

/**
 * @param {TypeDefn|InlineDefn} typeDef
 * @param {TypeName} typeName
 * @returns
 */
function typeKind (typeDef, typeName) {
  const keys = Object.keys(typeDef)
  if (!keys.length) {
    throw new TypeError(`Malformed type definition: empty ("${typeName}")`)
  }
  if (keys.length > 1) {
    throw new TypeError(`Malformed type definition: expected single kind key ("${typeName}")`)
  }
  return keys[0]
}
