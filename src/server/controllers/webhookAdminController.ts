import { Request, Response } from 'express';
import * as endpointService from '../services/endpointService.js';
import * as profileService from '../services/profileService.js';
import * as keyService from '../services/keyService.js';
import { listDeliveries, redeliver } from '../services/webhookDeliveryService.js';
import { sendApiError } from '../utils/apiError.js';

export async function createEndpoint(req: Request, res: Response) {
  try {
    const endpoint = await endpointService.createEndpoint(req.body);
    res.status(201).json(endpoint);
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function listEndpoints(_req: Request, res: Response) {
  try {
    res.json({ endpoints: await endpointService.listEndpoints() });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function getEndpoint(req: Request, res: Response) {
  try {
    res.json(await endpointService.getEndpointPublic(req.params.id));
  } catch (error) {
    sendApiError(res, error);
  }
}


export async function updateEndpoint(req: Request, res: Response) {
  try {
    res.json(await endpointService.updateEndpoint(req.params.id, req.body));
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function testEndpoint(req: Request, res: Response) {
  try {
    res.json(await endpointService.testEndpoint(req.params.id));
  } catch (error) {
    sendApiError(res, error);
  }
}
export async function setEndpointActive(req: Request, res: Response) {
  try {
    res.json(await endpointService.setEndpointActive(req.params.id, Boolean(req.body.active)));
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function createProfile(req: Request, res: Response) {
  try {
    const profile = await profileService.createProfile(req.body);
    res.status(201).json(profile);
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function listProfiles(_req: Request, res: Response) {
  try {
    res.json({ profiles: await profileService.listProfiles() });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    res.json(await profileService.getProfileOrThrow(req.params.id));
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function listKeys(_req: Request, res: Response) {
  try {
    res.json({ keys: await keyService.listKeys(res.locals.user.id) });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function createKey(req: Request, res: Response) {
  try {
    const { key, plaintext } = await keyService.createKey(req.body.name, res.locals.user.id);
    res.status(201).json({ ...key, apiKey: plaintext });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function revokeKey(req: Request, res: Response) {
  try {
    res.json(await keyService.revokeKey(req.params.id, res.locals.user.id, res.locals.apiKeyId));
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function getDeliveries(req: Request, res: Response) {
  try {
    const endpointId = typeof req.query.endpointId === 'string' ? req.query.endpointId : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    res.json({ deliveries: await listDeliveries({ endpointId, limit }) });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function redeliverDelivery(req: Request, res: Response) {
  try {
    res.status(201).json(await redeliver(req.params.id));
  } catch (error) {
    sendApiError(res, error);
  }
}

