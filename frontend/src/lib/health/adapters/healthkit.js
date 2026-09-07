export const healthKitAdapter = { id: 'healthkit', platform: 'ios', available: false, async connect() { throw new Error('HealthKit adapter is not installed') } }
