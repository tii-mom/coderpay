export function omitDeviceSecret<T extends { deviceSecret?: string | null }>(device: T) {
  const { deviceSecret: _deviceSecret, ...safeDevice } = device;
  return safeDevice;
}
