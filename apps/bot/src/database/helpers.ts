import { prisma } from './PrismaClient';
import { cache } from '../core/cache/CacheManager';

// Helper to get/upsert module config as parsed JSON
export async function getModuleConfig<T = Record<string, unknown>>(
  guildId: string,
  module: string
): Promise<{ enabled: boolean; config: T }> {
  const cacheKey = `moduleconfig:${guildId}:${module}`;
  const cached = cache.get<{ enabled: boolean; config: T }>(cacheKey);
  if (cached) return cached;

  const record = await prisma.moduleConfig.findUnique({
    where: { guildId_module: { guildId, module } },
  });

  const result = {
    enabled: record?.enabled ?? true,
    config: record ? (JSON.parse(record.config) as T) : ({} as T),
  };

  cache.set(cacheKey, result, 60);
  return result;
}

export async function setModuleConfig<T = Record<string, unknown>>(
  guildId: string,
  module: string,
  config: Partial<T>,
  enabled?: boolean
): Promise<void> {
  const existing = await getModuleConfig<T>(guildId, module);
  const merged = { ...existing.config, ...config };

  await prisma.moduleConfig.upsert({
    where: { guildId_module: { guildId, module } },
    create: {
      guildId,
      module,
      enabled: enabled ?? existing.enabled,
      config: JSON.stringify(merged),
    },
    update: {
      config: JSON.stringify(merged),
      ...(enabled !== undefined ? { enabled } : {}),
    },
  });

  // Invalidate cache
  cache.del(`moduleconfig:${guildId}:${module}`);
}

export async function ensureGuild(guildId: string, name?: string, ownerId?: string): Promise<void> {
  await prisma.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, name: name ?? '', ownerId: ownerId ?? '' },
    update: name ? { name } : {},
  });
}

export async function ensureUser(userId: string, username?: string): Promise<void> {
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, username: username ?? '' },
    update: username ? { username } : {},
  });
}

export async function ensureMember(guildId: string, userId: string): Promise<void> {
  await ensureGuild(guildId);
  await ensureUser(userId);
  await prisma.guildMember.upsert({
    where: { guildId_userId: { guildId, userId } },
    create: { guildId, userId },
    update: {},
  });
}
