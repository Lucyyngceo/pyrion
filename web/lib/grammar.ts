// Number agreement for sentences that put a count before a verb. Pure.

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "1 investigation lacks the values", "2 investigations lack the values". */
export const countVerb = (n: number, noun: string, singularVerb: string, pluralVerb: string) => `${plural(n, noun)} ${n === 1 ? singularVerb : pluralVerb}`;
