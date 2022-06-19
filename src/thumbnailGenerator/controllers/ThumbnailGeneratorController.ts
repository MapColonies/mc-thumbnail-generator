import { Readable } from 'stream';
import fs from 'fs/promises';
import fsSync from 'fs';
import httpStatusCodes from 'http-status-codes';
import { Logger } from '@map-colonies/js-logger';
import { IConfig } from 'config';
import { RequestHandler } from 'express';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import PuppeteerOperations from '../../common/utils/PuppeteerOperations';
import SearchLayersOperations from '../../common/utils/SearchLayersOperations';
import { ProductType } from '../models/ProductType';

type GetLayerScreenshots = RequestHandler<undefined>;


@injectable()
export default class ThumbnailGeneratorController {
  private readonly zipName: string;
  
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.PUPPETEER_OPERATIONS) private readonly puppeteerOps: PuppeteerOperations,
    @inject(SERVICES.SEARCH_LAYER_OPERATIONS) private readonly searchLayerOps: SearchLayersOperations,
    @inject(SERVICES.CONFIG) private readonly config: IConfig
  ) {
    this.zipName = this.config.get<string>("thumbnailGenerator.zipName");
  }

  public getLayerScreenShots: GetLayerScreenshots = async (req, res, next) => {
    try {
      const { productId, productType } = req.query as Record<string, string>;
      const recordUrl = await this.searchLayerOps.getLayerUrl(productId, productType as ProductType);
      const zipStream = await this.puppeteerOps.getLayerScreenshots(recordUrl.url, recordUrl.bbox, productType, productId);

      if (zipStream instanceof fsSync.ReadStream) {
        this.logger.info(`[ThumbnailGeneratorController][getLayerScreenShots] Finalizing, streaming zip file.`);

        res.set('Content-disposition', `attachment; filename="${this.zipName}"`);
        res.set('Content-Type', 'application/zip');

        zipStream.pipe(res);

        zipStream.on('close', () => {
          this.puppeteerOps
            .cleanTempFiles()
            .catch((e) => {
              this.logger.error(`[ThumbnailGeneratorController][getLayerScreenShots] There was a problem cleaning temp data. ${e as string}`);
            });
        });

        zipStream.on('error', (e) => {
          this.logger.error(`[ThumbnailGeneratorController][getLayerScreenShots] There was an error streaming the zip ${e.message}`);
          res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('There was an error streaming the zip');
        });
      } else {
        res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).send('There was an error generating thumbnails zip.');
      }
    } catch (e) {
      next(e);
    }
  };
}
