// Pure weight-unit helpers; safe for shared calculations and plain-Node consumers.
export const LB_PER_KG = 2.2046226218487757
export const weightUnit = (value, fallback) => value === 'kg' || value === 'lb' ? value : fallback
export const weightConversionFactor = (from, to) => from === to ? 1 : to === 'lb' ? LB_PER_KG : 1 / LB_PER_KG
