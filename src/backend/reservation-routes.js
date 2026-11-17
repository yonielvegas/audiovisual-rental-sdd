import { requireSession } from './access.js';
import { readJsonBody, sendJson } from './http.js';

export function reservationRoutes(reservations) {
  return [
    ['/api/availability', {
      GET: {
        handler: async ({ response, query }) => {
          sendJson(response, 200, await reservations.availability({
            equipmentId: query.get('equipmentId'), start: query.get('start'), end: query.get('end'),
          }));
        },
      },
    }],
    ['/api/reservations', {
      GET: {
        actor: true,
        handler: async ({ response, actor }) => {
          const owner = requireSession(actor);
          sendJson(response, 200, { reservations: await reservations.listOwn(owner.id) });
        },
      },
      POST: {
        actor: true,
        handler: async ({ request, response, actor }) => {
          const owner = requireSession(actor);
          const reservation = await reservations.create(owner.id, await readJsonBody(request));
          sendJson(response, 201, { reservation });
        },
      },
    }],
    ['/api/reservations/:id', {
      PATCH: {
        actor: true,
        handler: async ({ request, response, actor, params }) => {
          const owner = requireSession(actor);
          const reservation = await reservations.cancelOwn(owner.id, params.id, await readJsonBody(request));
          sendJson(response, 200, { reservation });
        },
      },
    }],
  ];
}
