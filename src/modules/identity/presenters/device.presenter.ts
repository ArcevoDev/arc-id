import type { Device } from "@prisma-client";

export function presentDevice(device: Device) {
  return {
    id: device.id,
    platform: device.platform,
    browser: device.browser,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt,
  };
}
