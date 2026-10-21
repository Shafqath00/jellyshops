import express from 'express';
import { z } from 'zod';
import { requireMerchant, requireStorePermission } from '../auth/middleware.js';
import { hasStorePermission } from '../auth/permissions.js';
import type { AuthProvider, StorePermission } from '../auth/types.js';
import { ApiError } from '../http/errors.js';
import type { MerchantOrderService } from './merchant-orders.js';
import { invoiceHtml, invoicePdf } from './order-management-invoice.js';
const revision = z.number().int().positive();
const idempotencyKey = z.string().min(1).max(200);
const item = z.object({ variantId: z.string().min(1), configurationKey: z.string().optional(), quantity: z.number().int().positive() });
const edit = z.object({ revision, items: z.array(item).min(1).max(250), shippingMinor: z.number().int().nonnegative().optional() });
const tracking = z.object({ trackingNumber: z.string().max(250).optional(), carrier: z.string().max(150).optional(), trackingUrl: z.url().refine(value => /^https?:/.test(value)).optional() });
const snapshot = z.record(z.string(), z.unknown());
export function createMerchantOrderRouter(service: MerchantOrderService, auth: AuthProvider): express.Router {
    const router = express.Router({ mergeParams: true });
    router.use(requireMerchant(auth));
    const route = (method: 'get' | 'post' | 'patch', path: string, permission: StorePermission, handler: (req: express.Request, res: express.Response) => Promise<unknown>) => { router[method](path, requireStorePermission(permission), async (req, res, next) => { try {
        const legacy = path === "/:orderId/fulfilment" || (path === "/:orderId/refunds" && (!req.body || Object.keys(req.body).length === 0));
        if (method !== "get" && path !== "/settings" && !legacy && !(await service.management.settings(req.storeContext!.storeId)).enabled)
            throw new ApiError(409, "ORDER_MANAGEMENT_DISABLED", "Enable order management in store settings first.");
        await handler(req, res);
    }
    catch (error) {
        next(error);
    } }); };
    const ids = (req: express.Request) => [req.storeContext!.storeId, String(req.params.orderId)] as const;
    route('get', '/settings', 'settings:manage', async (req, res) => { res.json(await service.management.settings(req.storeContext!.storeId)); });
    route('patch', '/settings', 'settings:manage', async (req, res) => { const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body); res.json(await service.management.updateSettings(req.storeContext!.storeId, enabled)); });
    route('get', '/', 'orders:view', async (req, res) => { const query = z.object({ query: z.string().max(300).optional(), status: z.string().optional(), paymentStatus: z.string().optional(), sort: z.enum(['date', 'status', 'amount']).optional(), direction: z.enum(['asc', 'desc']).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) }).parse(req.query); res.json(await service.search(req.storeContext!.storeId, query)); });
    route('get', '/:orderId', 'orders:view', async (req, res) => { const [storeId, orderId] = ids(req); const detail = await service.get(storeId, orderId); const manage = !!detail.featureEnabled && hasStorePermission(req.merchant!, storeId, 'orders:manage'); const refund = !!detail.featureEnabled && hasStorePermission(req.merchant!, storeId, 'orders:refund'); res.json({ ...detail, capabilities: { manage, refund, edit: refund && ['PAID', 'CONFIRMED'].includes(String(detail.order.status)) && !detail.order.fulfilmentStartedAt } }); });
    route('post', '/:orderId/notes', 'orders:manage', async (req, res) => { const { body } = z.object({ body: z.string().trim().min(1).max(10000) }).parse(req.body); res.status(201).json(await service.management.note(...ids(req), body, req.merchant!.userId)); });
    route('patch', '/:orderId/contact', 'orders:manage', async (req, res) => { const input = z.object({ revision, customerSnapshot: snapshot, deliverySnapshot: snapshot.optional(), billingAddress: snapshot.optional() }).parse(req.body); res.json(await service.management.contact(...ids(req), input)); });
    route('patch', '/:orderId/tracking', 'orders:manage', async (req, res) => { const input = tracking.extend({ revision, fulfilmentId: z.string().optional() }).parse(req.body); res.json(await service.management.tracking(...ids(req), input)); });
    route('post', '/:orderId/fulfilment', 'orders:manage', async (req, res) => { const { status } = z.object({ status: z.string().min(1) }).parse(req.body); res.json(await service.transition(...ids(req), status)); });
    route('post', '/:orderId/fulfilments', 'orders:manage', async (req, res) => { const input = tracking.extend({ revision, items: z.array(item).min(1) }).parse(req.body); res.status(201).json(await service.management.fulfil(...ids(req), input)); });
    route('post', '/:orderId/fulfilments/:fulfilmentId/deliver', 'orders:manage', async (req, res) => { const input = z.object({ revision }).parse(req.body); res.json(await service.management.deliver(...ids(req), String(req.params.fulfilmentId), input.revision)); });
    route('post', '/:orderId/returns', 'orders:manage', async (req, res) => { const input = z.object({ revision, items: z.array(item).min(1), reason: z.string().trim().min(1).max(2000) }).parse(req.body); res.status(201).json(await service.management.createReturn(...ids(req), input)); });
    route('post', '/:orderId/returns/:returnId/receive', 'orders:manage', async (req, res) => { const input = z.object({ revision, sellable: z.boolean() }).parse(req.body); res.json(await service.management.receiveReturn(...ids(req), String(req.params.returnId), input)); });
    route('post', '/:orderId/edits/preview', 'orders:refund', async (req, res) => { res.json(await service.management.preview(...ids(req), edit.parse(req.body))); });
    route('post', '/:orderId/edits', 'orders:refund', async (req, res) => { res.status(201).json(await service.management.edit(...ids(req), edit.extend({ idempotencyKey }).parse(req.body))); });
    route('post', '/:orderId/refunds', 'orders:refund', async (req, res) => { const hasBody = req.body && Object.keys(req.body).length > 0; if (!hasBody) {
        res.status(201).json(await service.refund(...ids(req)));
        return;
    } const input = z.object({ revision, idempotencyKey, amountMinor: z.number().int().positive().optional(), items: z.array(item).min(1).max(250).optional(), reason: z.string().max(2000).optional() }).strict().parse(req.body); res.status(201).json(await service.management.refund(...ids(req), input)); });
    route('post', '/:orderId/cancel', 'orders:manage', async (req, res) => { const input = z.object({ revision, idempotencyKey, reason: z.string().max(2000).optional() }).parse(req.body); const detail = await service.get(...ids(req)); if (detail.payment?.status === 'PAID' && !hasStorePermission(req.merchant!, req.storeContext!.storeId, 'orders:refund'))
        throw new ApiError(403, 'STORE_FORBIDDEN', 'Cancelling a paid order requires refund permission.'); res.status(202).json(await service.management.cancel(...ids(req), input)); });
    route('get', '/:orderId/invoice', 'orders:view', async (req, res) => { const detail = await service.get(...ids(req)); const chosen = typeof req.query.revision === 'string' ? detail.revisions.find((r: any) => String(r.number) === req.query.revision && r.status === 'APPLIED') : detail.revisions.find((r: any) => r.status === 'APPLIED'); const data = chosen?.snapshot ? (chosen.snapshot.order ? { order: { ...chosen.snapshot.order, ...chosen.snapshot, items: undefined, order: undefined }, items: chosen.snapshot.items } : chosen.snapshot) : detail; res.setHeader('Cache-Control', 'private, no-store'); if (req.query.format === 'pdf') {
        res.type('application/pdf').setHeader('Content-Disposition', `attachment; filename="invoice-${String(detail.order.number).replace(/[^a-zA-Z0-9-]/g, '')}.pdf"`);
        res.send(invoicePdf(data));
    }
    else
        res.type('html').send(invoiceHtml(data)); });
    return router;
}
