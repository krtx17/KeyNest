import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ItemService } from '../items/itemService.ts';
import { requireAuth } from '../auth/authMiddleware.ts';

export const itemRouter = Router();

const createItemSchema = z.object({
  workspaceId: z.string().min(1),
  collectionId: z.string().optional(),
  payloadEnc: z.string().min(1),
  nonce: z.string().min(1),
  encVersion: z.number().int().positive().default(1),
  keyVersion: z.number().int().positive().default(1),
  wrappedKeys: z
    .array(
      z.object({
        recipientUserId: z.string().min(1),
        wrappedKey: z.string().min(1),
        permission: z.enum(['view_copy', 'edit']).default('edit'),
      })
    )
    .default([]),
});

const updateItemSchema = z.object({
  payloadEnc: z.string().min(1),
  nonce: z.string().min(1),
  encVersion: z.number().int().positive().optional(),
  keyVersion: z.number().int().positive().optional(),
});

// GET /items
itemRouter.get('/items', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'workspaceId query parameter required' } });
    }
    const items = ItemService.listItems(req.user!.id, workspaceId);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
});

// POST /items
itemRouter.post('/items', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createItemSchema.parse(req.body);
    const result = ItemService.createItem({
      userId: req.user!.id,
      ...parsed,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /items/:id
itemRouter.get('/items/:id', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = ItemService.getItem(req.user!.id, req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /items/:id
itemRouter.put('/items/:id', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateItemSchema.parse(req.body);
    const ifMatch = req.headers['if-match'];
    const expectedRevision = ifMatch ? parseInt(ifMatch, 10) : undefined;

    const result = ItemService.updateItem({
      userId: req.user!.id,
      itemId: req.params.id,
      expectedRevision: isNaN(expectedRevision!) ? undefined : expectedRevision,
      ...parsed,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /items/:id
itemRouter.delete('/items/:id', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = ItemService.deleteItem(req.user!.id, req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /sync
itemRouter.get('/sync', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;

    if (!workspaceId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'workspaceId query parameter required' } });
    }

    const result = ItemService.sync(req.user!.id, workspaceId, isNaN(since) ? 0 : since);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
