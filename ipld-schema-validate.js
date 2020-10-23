/* eslint-disable no-new-func */

const ScalarKindNames = ['Null', 'Int', 'Float', 'String', 'Bool', 'Bytes', 'Link']
// const KindNames = ScalarKindNames.concat(['List', 'Map'])
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

function tc (s) { return s.charAt(0).toUpperCase() + s.substring(1) }

function kindDefn (obj) {
  if (typeof obj === 'string' && ScalarKindNames.includes(obj)) {
    return obj
  }
  if (typeof obj === 'object' && typeof obj.kind === 'string' && ScalarKindNamesLower.includes(obj.kind)) {
    return tc(obj.kind)
  }
  return null
}

function create (schema, root) {
  if (!root || typeof root !== 'string') {
    throw new TypeError('A root is required')
  }

  // shortcut for simple kind
  const rootKind = kindDefn(root)
  if (rootKind) {
    return new Function('obj', `${KindsDefn}; return Kinds.${rootKind}(obj)`)
  }

  if (!schema || !schema.types || !Object.keys(schema.types).length) {
    throw new TypeError('Invalid schema definition')
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

    const typeKind = kindDefn(typeDef)
    if (typeKind) {
      typeValidators[typeName] = `return Kinds.${typeKind}(obj)`
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
      let valueValidator = ''
      const valueKind = kindDefn(typeDef.valueType)
      if (valueKind) {
        valueValidator = `Kinds.${valueKind}`
      } else {
        const valueTypeName = defineType(typeDef.valueType, 'valueType')
        valueValidator = `Types["${valueTypeName}"]`
      }
      if (typeDef.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }
      typeValidators[typeName] = `return Kinds.List(obj) && Array.prototype.every.call(obj, ${valueValidator})`

      return
    }

    if (typeDef.kind === 'map') {
      if (typeDef.keyType !== 'String') {
        throw new Error(`Invalid keyType for Map "${typeName}", expected String, found "${typeDef.keyType}"`)
      }
      let valueValidator = ''
      const valueKind = kindDefn(typeDef.valueType)
      if (valueKind) {
        valueValidator = `Kinds.${valueKind}`
      } else {
        const valueTypeName = defineType(typeDef.valueType, 'valueType')
        valueValidator = `Types["${valueTypeName}"]`
      }
      if (typeDef.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }
      typeValidators[typeName] = `return Kinds.Map(obj) && Array.prototype.every.call(Object.values(obj), ${valueValidator})`

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
      if (Object.keys(typeDef.representation[representation]).length) {
        throw new Error(`Unsupported representation parameters for "${typeName}"`)
      }

      const requiredFields = []
      for (const [fieldName, fieldDef] of Object.entries(typeDef.fields)) {
        const fieldKey = `${typeName} > ${fieldName}`
        if (representation !== 'map' || fieldDef.optional !== true) {
          requiredFields.push(fieldName)
        }
        if (representation !== 'map' && fieldDef.optional === true) {
          throw new Error('Don\'t support "optional" fields for non-map structs')
        }
        let fieldValidator = ''
        const fieldKind = kindDefn(fieldDef.type) || kindDefn(fieldDef) // { type: 'String' } || { kind: 'link' }
        if (fieldKind) {
          fieldValidator = `Kinds.${fieldKind}(obj)`
        } else {
          const fieldTypeName = defineType(fieldDef.type, fieldName)
          fieldValidator = `Types["${fieldTypeName}"](obj)`
        }
        if (fieldDef.nullable === true) {
          fieldValidator = `obj === null || ${fieldValidator}`
        }
        typeValidators[fieldKey] = `return ${fieldValidator}`
      }

      if (representation === 'tuple') {
        typeValidators[typeName] = `return Kinds.List(obj) && obj.length === ${requiredFields.length}${requiredFields.map((fieldName, i) => ` && Types["${typeName} > ${fieldName}"](obj[${i}])`).join('')}`
      } else {
        typeValidators[typeName] = `const keys = obj && Object.keys(obj); return Kinds.Map(obj) && ${JSON.stringify(requiredFields)}.every((k) => keys.includes(k)) && Object.entries(obj).every(([name, value]) => Types["${typeName} > " + name] && Types["${typeName} > " + name](value))`
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
          let validator
          if (ScalarKindNames.includes(innerTypeName)) {
            validator = `Kinds.${innerTypeName}`
          } else {
            addType(innerTypeName)
            validator = `Types["${innerTypeName}"]`
          }
          return `(keys[0] === "${key}" && ${validator}(obj["${key}"]))`
        })
        typeValidators[typeName] = `const keys = obj && Object.keys(obj); return Kinds.Map(obj) && keys.length === 1 && ${JSON.stringify(Object.keys(keys))}.includes(keys[0]) && (${validators.join(' || ')})`

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
        typeValidators[typeName] = `return ${validators.join(' || ')}`

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
        typeValidators[typeName] = `const key = obj && obj["${inline.discriminantKey}"]; if (!Kinds.Map(obj) || !Kinds.String(key)) { return false }; obj = Object.assign({}, obj); delete obj["${inline.discriminantKey}"]; return ${validators.join(' || ')}`

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
        typeValidators[typeName] = `const key = obj && obj["${envelope.discriminantKey}"]; const content = obj && obj["${envelope.contentKey}"]; return Kinds.Map(obj) && Kinds.String(key) && content !== undefined && (${validators.join(' || ')})`

        return
      }

      throw new Error(`Unsupported union type for "${typeName}": "${Object.keys(typeDef.representation).join(',')}"`)
    } else {
      throw new Error(`Can't deal with type kind: "${typeDef.kind}"`)
    }
  }

  addType(root)

  let fn = `${KindsDefn};\n`
  fn += `const Types = {\n${Object.entries(typeValidators).map(([name, fn]) => `  ["${name}"]: (obj) => { ${fn} }`).join(',\n')}\n};\n`
  fn += `return Types["${root}"](obj);`
  // console.log(fn)

  return new Function('obj', fn)
}

export default { create }
