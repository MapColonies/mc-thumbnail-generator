import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import ThumbnailGeneratorController from '../controllers/ThumbnailGeneratorController';

const getThumbnailGeneratorRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(ThumbnailGeneratorController);

  router.get('/screenshot', controller.getLayerScreenShots);

  return router;
};

export const GET_THUMBNAIL_GENERATOR_ROUTER_SYMBOL = Symbol('getThumbnailGeneratorRouterFactory');

export { getThumbnailGeneratorRouterFactory };
