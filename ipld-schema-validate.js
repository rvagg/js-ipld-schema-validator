/* eslint-disable no-new-func */

const ScalarKindNames = ['Null', 'Int', 'Float', 'String', 'Bool', 'Bytes', 'Link']
const ScalarKindNamesLower = ScalarKindNames.map((n) => n.toLowerCase())

const KindsDefn = `
const Kinds = {
  Null: (obj) => obj === null,
  Int: (obj) => Number.isInteger(obj),
  Float: (obj) => typeof obj === "number" && !Kinds.Int(obj),
  String: (obj) => typeof obj === "string",
  Bool: (obj) => typeof obj === "boolean",
  Bytes: (obj) => obj instanceof Uint8Array,
  Link: (obj) => !Kinds.Null(obj) && typeof obj === "object" && obj["asCID"] === obj,
  List: (obj) => Array.isArray(obj),
  Map: (obj) => !Kinds.Null(obj) && typeof obj === "object" && obj["asCID"] !== obj && !Kinds.List(obj) && !Kinds.Bytes(obj)
}`

const implicits = ScalarKindNames.reduce((p, c) => {
  p[c] = { kind: c.toLowerCase() }
  return p
}, {})

implicits.AnyScalar = {
  kind: 'union',
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

function tc (s) { return s.charAt(0).toUpperCase() + s.substring(1) }

function create (schema, root) {
  if (!root || typeof root !== 'string') {
    throw new TypeError('A root is required')
  }

  if (!schema || typeof schema.types !== 'object') {
    throw new TypeError('Invalid schema definition')
  }

  // new schema with implicits
  schema = {
    types: Object.assign({}, implicits, schema.types)
  }

  const typeValidators = {}

  const addType = (typeName, typeDef) => {
    if (typeValidators[typeName]) { // already added this one
      return
    }

    if (!typeDef) {
      if (typeof schema.types[typeName] !== 'object') {
        throw new TypeError(`A type must match an existing type definition ("${typeName}")`)
      }
      typeDef = schema.types[typeName]
    }

    if (typeof typeDef === 'object' && typeof typeDef.kind === 'string' && ScalarKindNamesLower.includes(typeDef.kind)) {
      typeValidators[typeName] = `Kinds.${tc(typeDef.kind)}`
      return
    }

    const defineType = (defType, name) => {
      if (defType === typeName) {
        throw new Error(`Recursive typedef in type "${typeName}"`)
      }
      let innerTypeName = defType
      if (typeof innerTypeName === 'object' && defType.kind) { // anonymous inline map or list!
        innerTypeName = `${typeName} > ${name} (anon)`
        addType(innerTypeName, defType)
      } else if (typeof innerTypeName === 'string') {
        addType(innerTypeName)
      } else {
        throw new Error(`Bad field type for "${typeName}": "${name}"`)
      }
      return innerTypeName
    }

    if (typeDef.kind === 'list') {
      const valueTypeName = defineType(typeDef.valueType, 'valueType')
      let valueValidator = `Types["${valueTypeName}"]`
      if (typeDef.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }
      typeValidators[typeName] = `(obj) => Kinds.List(obj) && Array.prototype.every.call(obj, ${valueValidator})`

      return
    }

    if (typeDef.kind === 'map') {
      if (typeDef.keyType !== 'String') {
        throw new Error(`Invalid keyType for Map "${typeName}", expected String, found "${typeDef.keyType}"`)
      }

      let representation = 'map'
      if (typeDef.representation) {
        if (typeof typeDef.representation.listpairs === 'object') {
          representation = 'listpairs'
        } else if (typeof typeDef.representation.map !== 'object') {
          throw new Error(`Unsupported map representation "${Object.keys(typeDef.representation).join(',')}"`)
        }
      }

      const valueTypeName = defineType(typeDef.valueType, 'valueType')
      let valueValidator = `Types["${valueTypeName}"]`
      if (typeDef.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }

      if (representation === 'listpairs') {
        typeValidators[typeName] = `(obj) => Kinds.List(obj) && Array.prototype.every.call(obj, (e) => Kinds.List(e) && e.length === 2 && Kinds.String(e[0]) && (${valueValidator})(e[1]))`
        return
      }

      typeValidators[typeName] = `(obj) => Kinds.Map(obj) && Array.prototype.every.call(Object.values(obj), ${valueValidator})`

      return
    }

    if (typeDef.kind === 'struct') {
      let representation = 'map'
      if (typeDef.representation) {
        if (typeof typeDef.representation.tuple === 'object') {
          representation = 'tuple'
        } else if (typeof typeDef.representation.map !== 'object') {
          throw new Error(`Unsupported struct representation "${Object.keys(typeDef.representation).join(',')}"`)
        }
      }

      let requiredFields = []
      for (let [fieldName, fieldDef] of Object.entries(typeDef.fields)) {
        let required = representation !== 'map' || fieldDef.optional !== true

        if (typeof typeDef.representation.map === 'object' &&
            typeof typeDef.representation.map.fields === 'object' &&
            typeof typeDef.representation.map.fields[fieldName] === 'object') {
          if (typeDef.representation.map.fields[fieldName].implicit !== undefined) {
            required = false
          }
          if (typeof typeDef.representation.map.fields[fieldName].rename === 'string') {
            fieldName = typeDef.representation.map.fields[fieldName].rename
          }
        }

        const fieldKey = `${typeName} > ${fieldName}`
        if (required) {
          requiredFields.push(fieldName)
        }
        if (representation !== 'map' && fieldDef.optional === true) {
          throw new Error('Don\'t support "optional" fields for non-map structs')
        }
        const fieldTypeName = defineType(fieldDef.type, fieldName)
        let fieldValidator = `Types["${fieldTypeName}"](obj)`
        if (fieldDef.nullable === true) {
          fieldValidator = `obj === null || ${fieldValidator}`
        }
        typeValidators[fieldKey] = `(obj) => ${fieldValidator}`
      }

      if (representation === 'tuple') {
        if (Array.isArray(typeDef.representation.tuple.fieldOrder)) {
          requiredFields = typeDef.representation.tuple.fieldOrder
        }
        typeValidators[typeName] = `(obj) => Kinds.List(obj) && obj.length === ${requiredFields.length}${requiredFields.map((fieldName, i) => ` && Types["${typeName} > ${fieldName}"](obj[${i}])`).join('')}`
      } else {
        typeValidators[typeName] = `(obj) => { const keys = obj && Object.keys(obj); return Kinds.Map(obj) && ${JSON.stringify(requiredFields)}.every((k) => keys.includes(k)) && Object.entries(obj).every(([name, value]) => Types["${typeName} > " + name] && Types["${typeName} > " + name](value)) }`
      }

      return
    }

    if (typeDef.kind === 'union') {
      if (typeof typeDef.representation !== 'object') {
        throw new Error(`Bad union definition for "${typeName}`)
      }

      if (typeof typeDef.representation.keyed === 'object') {
        const keys = typeDef.representation.keyed
        const validators = Object.entries(keys).map(([key, innerTypeName]) => {
          if (typeof innerTypeName !== 'string') {
            throw new Error(`Keyed union "${typeName} refers to non-string type name: "${innerTypeName}"`)
          }
          addType(innerTypeName)
          const validator = `Types["${innerTypeName}"]`
          return `(keys[0] === "${key}" && ${validator}(obj["${key}"]))`
        })
        typeValidators[typeName] = `(obj) => { const keys = obj && Object.keys(obj); return Kinds.Map(obj) && keys.length === 1 && ${JSON.stringify(Object.keys(keys))}.includes(keys[0]) && (${validators.join(' || ')}) }`

        return
      }

      if (typeof typeDef.representation.kinded === 'object') {
        const kinds = typeDef.representation.kinded
        const validators = Object.entries(kinds).map(([kind, innerTypeName]) => {
          if (typeof innerTypeName !== 'string') {
            throw new Error(`Kinded union "${typeName} refers to non-string type name: "${innerTypeName}"`)
          }
          addType(innerTypeName)
          // the Kinds.X(obj) prefix here results in a double-check in practice once we go into Types["Y"],
          // because we should be able to presume that the type in question will do a kind check of its own.
          // _But_, it makes sure that a broken schema that uses a bad kind discriminator will properly fail
          // instead of erroneously passing
          return `(Kinds.${tc(kind)}(obj) && Types["${innerTypeName}"](obj))`
        })
        typeValidators[typeName] = `(obj) => ${validators.join(' || ')}`

        return
      }

      if (typeof typeDef.representation.inline === 'object') {
        const inline = typeDef.representation.inline
        if (typeof inline.discriminantKey !== 'string') {
          throw new Error(`Expected "discriminantKey" for inline union "${typeName}"`)
        }
        if (typeof inline.discriminantTable !== 'object') {
          throw new Error(`Expected "discriminantTable" for inline union "${typeName}"`)
        }
        const validators = Object.entries(inline.discriminantTable).map(([key, innerTypeName]) => {
          if (typeof innerTypeName !== 'string') {
            throw new Error(`Inline union "${typeName} refers to non-string type name: "${innerTypeName}"`)
          }
          addType(innerTypeName)
          return `(key === "${key}" && Types["${innerTypeName}"](obj))`
        })
        typeValidators[typeName] = `(obj) => { const key = obj && obj["${inline.discriminantKey}"]; if (!Kinds.Map(obj) || !Kinds.String(key)) { return false }; obj = Object.assign({}, obj); delete obj["${inline.discriminantKey}"]; return ${validators.join(' || ')} }`

        return
      }

      if (typeof typeDef.representation.envelope === 'object') {
        const envelope = typeDef.representation.envelope
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
            throw new Error(`Inline union "${typeName} refers to non-string type name: "${innerTypeName}"`)
          }
          addType(innerTypeName)
          return `(key === "${key}" && Types["${innerTypeName}"](content))`
        })
        typeValidators[typeName] = `(obj) => { const key = obj && obj["${envelope.discriminantKey}"]; const content = obj && obj["${envelope.contentKey}"]; return Kinds.Map(obj) && Kinds.String(key) && content !== undefined && (${validators.join(' || ')}) }`

        return
      }

      if (typeof typeDef.representation.byteprefix === 'object') {
        const bytes = Object.values(typeDef.representation.byteprefix)
        for (const byte of bytes) {
          if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
            throw new Error(`Invalid byteprefix byte for "${typeName}": "${byte}"`)
          }
        }

        typeValidators[typeName] = `(obj) => { return Kinds.Bytes(obj) && obj.length >= 1 && ${JSON.stringify(bytes)}.includes(obj[0]) }`

        return
      }

      throw new Error(`Unsupported union type for "${typeName}": "${Object.keys(typeDef.representation).join(',')}"`)
    }

    throw new Error(`Can't deal with type kind: "${typeDef.kind}"`)
  }

  addType(root)

  let fn = `${KindsDefn};\n`
  fn += `const Types = {\n${Object.entries(typeValidators).map(([name, fn]) => `  ["${name}"]: ${fn}`).join(',\n')}\n};\n`
  fn += `return Types["${root}"](obj);`
  // console.log(fn)

  return new Function('obj', fn)
}

export default { create }
