import { Logger } from '@map-colonies/js-logger';
import { IConfig } from 'config';
import { RequestHandler } from 'express';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import PuppeteerOperations from '../../common/utils/PuppeteerOperations';
import SearchLayersOperations from '../../common/utils/SearchLayersOperations';

type GetLayerScreenshots = RequestHandler<undefined>;

@injectable()
export default class ThumbnailGeneratorController {

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.PUPPETEER_OPERATIONS) private readonly puppeteerOps: PuppeteerOperations,
    @inject(SERVICES.SEARCH_LAYER_OPERATIONS) private readonly searchLayerOps: SearchLayersOperations,
    @inject(SERVICES.CONFIG) private readonly config: IConfig
  ) {}

  public getLayerScreenShots: GetLayerScreenshots = async (req, res, next) => {
    try {
      const {productId, productType} = req.query as Record<string, string>;
      const recordUrl = await this.searchLayerOps.getLayerUrl(productId, productType);

      await this.puppeteerOps.getLayerScreenshots(recordUrl, productType);

      res.send('OK!');
    } catch (e) {
      next(e);
    }
  };
}
