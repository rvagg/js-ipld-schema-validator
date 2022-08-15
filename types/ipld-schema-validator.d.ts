/**
 * @param {string} name
 * @returns {string}
 */
export function safeReference(name: string): string;
/**
 * @param {Schema} schema
 * @param {string} root
 * @returns {ValidatorFunction}
 */
export function create(schema: Schema, root: string): ValidatorFunction;
export class Builder {
    /**
     * @param {Schema} schema
     */
    constructor(schema: Schema);
    schema: {
        types: {
            [x: string]: import("ipld-schema/schema-schema").TypeDefn;
        } & {
            [x: string]: import("ipld-schema/schema-schema").TypeDefn;
        };
    };
    /** @type {Record<string, string>} */
    typeValidators: Record<string, string>;
    dumpValidators(): string;
    /**
     * @param {TypeName} typeName
     * @param {TypeDefn} [typeDef]
     * @returns {void}
     */
    addType(typeName: TypeName, typeDef?: import("ipld-schema/schema-schema").TypeDefn | undefined): void;
}
export type EnumMember = import('ipld-schema/schema-schema').EnumMember;
export type KindInt = import('ipld-schema/schema-schema').KindInt;
export type KindString = import('ipld-schema/schema-schema').KindString;
export type Schema = import('ipld-schema/schema-schema').Schema;
export type TypeDefn = import('ipld-schema/schema-schema').TypeDefn;
export type InlineDefn = import('ipld-schema/schema-schema').InlineDefn;
export type TypeName = import('ipld-schema/schema-schema').TypeName;
export type TypeNameOrInlineDefn = import('ipld-schema/schema-schema').TypeNameOrInlineDefn;
export type ValidatorFunction = (obj: any) => boolean;
//# sourceMappingURL=ipld-schema-validator.d.ts.map