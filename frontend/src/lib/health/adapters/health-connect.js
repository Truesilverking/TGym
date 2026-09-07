export const healthConnectAdapter = { id: 'health-connect', platform: 'android', available: false, async connect() { throw new Error('Health Connect adapter is not installed') } }
