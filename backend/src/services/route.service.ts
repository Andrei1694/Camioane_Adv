import { Prisma } from '../generated/prisma/client.ts';
import type { SavedRoute } from '../generated/prisma/client.ts';
import { AppError } from '../lib/app-error.ts';
import { isRoleValid } from '../lib/role.ts';
import { parseRouteWaypoints } from '../lib/route-validation.ts';
import { serializable } from '../lib/transaction.ts';
import type { RouteInput, RoutePagination, RouteUpdate } from '../types/route.ts';
import type { SessionIdentity } from '../types/user.ts';

const conflict = 'This route changed during editing. Reload the latest route and try again.';

async function transaction<T>(actor: SessionIdentity, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await serializable(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: actor.id }, select: { sessionVersion: true, role: true } });
      if (!user || user.sessionVersion !== actor.sessionVersion) throw new AppError(401, 'Unauthorized');
      if (user.role.name !== 'ADMIN' || !isRoleValid(user.role)) throw new AppError(403, 'Administrator access is required');
      return action(tx);
    }, 'Routes changed during this request. Refresh and try again.');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new AppError(404, 'Route not found');
    throw error;
  }
}

function publicRoute(route: SavedRoute) {
  try {
    return { ...route, waypoints: parseRouteWaypoints(route.waypoints) };
  } catch {
    throw new Error('Invalid stored route stops');
  }
}

export function createRouteService() {
  return {
    list(actor: SessionIdentity, pagination: RoutePagination) {
      return transaction(actor, async (tx) => {
        const routes = await tx.savedRoute.findMany({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pagination.limit, skip: pagination.offset,
        });
        return { routes: routes.map(publicRoute), total: await tx.savedRoute.count() };
      });
    },
    get(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => {
        const route = await tx.savedRoute.findUnique({ where: { id } });
        if (!route) throw new AppError(404, 'Route not found');
        return publicRoute(route);
      });
    },
    create(actor: SessionIdentity, input: RouteInput) {
      return transaction(actor, async (tx) => publicRoute(await tx.savedRoute.create({ data: input })));
    },
    update(actor: SessionIdentity, id: string, input: RouteUpdate) {
      return transaction(actor, async (tx) => {
        const route = await tx.savedRoute.findUnique({ where: { id }, select: { version: true } });
        if (!route) throw new AppError(404, 'Route not found');
        if (route.version !== input.version) throw new AppError(409, conflict);
        const updated = await tx.savedRoute.updateMany({
          where: { id, version: input.version },
          data: { name: input.name, waypoints: input.waypoints, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new AppError(409, conflict);
        return publicRoute(await tx.savedRoute.findUniqueOrThrow({ where: { id } }));
      });
    },
    remove(actor: SessionIdentity, id: string) {
      return transaction(actor, async (tx) => { await tx.savedRoute.delete({ where: { id } }); });
    },
  };
}

export type RouteService = ReturnType<typeof createRouteService>;
