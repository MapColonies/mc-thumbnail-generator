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
  private readonly namespace: string;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.PUPPETEER_OPERATIONS) private readonly puppeteerOps: PuppeteerOperations,
    @inject(SERVICES.SEARCH_LAYER_OPERATIONS) private readonly searchLayerOps: SearchLayersOperations,
    @inject(SERVICES.CONFIG) private readonly config: IConfig
  ) {
    this.namespace = this.config.get<string>('kubernetes.namespace');
  }

  public getLayerScreenShots: GetLayerScreenshots = async (req, res, next) => {
    try {
      const {productId, productType} = req.query;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      // const response = await this.searchLayerOps.getLayersForRecord();
      const response = await this.searchLayerOps.getLayerUrl(productId as string, productType as string);
      // await this.puppeteerOps.getLayerScreenshots();

      // eslint-disable-next-line
      res.send(response)
    } catch (e) {
      next(e);
    }
  };
}
