import fs from 'fs/promises';
import fsSync from 'fs';
import archiver from 'archiver';
import { Logger } from '@map-colonies/js-logger';
import Puppeteer, { PageEmittedEvents } from 'puppeteer';
import Sharp from 'sharp';
import { inject, injectable, container } from 'tsyringe';
import { SERVICES, UTILS } from '../constants';
import { IConfig } from '../interfaces';
import { BROWSER_CLIENT_TOKEN, BROWSER_VIEW_PORT } from '../../containerConfig';
import { LayerUrlWithMetadata } from '../../thumbnailGenerator/interfaces';
import BrowserEventHandlers from './BrowserEventHandlers';

enum ThumbnailSizes {
  SMALL = 'sm',
  MEDIUM = 'md',
  LARGE = 'lg',
}

interface Screenshot {
  buffer: Buffer;
  fileName: string;
}

interface BrowserViewPort {
  width: number;
  height: number;
}

@injectable()
class PuppeteerOperations {
  private readonly tempLocation: string;
  private readonly tempZipLocation: string;
  private readonly thumbnailPresentorUrl: string;
  private readonly targetIconId: string;
  private readonly thumbnailSizes: Record<ThumbnailSizes, Puppeteer.Viewport>;
  private readonly tempScreenshotLocation: string;
  private readonly watermarkTimeout: string;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    this.thumbnailSizes = {
      [ThumbnailSizes.SMALL]: {
        width: 128,
        height: 128,
      },
      [ThumbnailSizes.MEDIUM]: {
        width: 400,
        height: 400,
      },
      [ThumbnailSizes.LARGE]: {
        width: 600,
        height: 600,
      },
    };

    this.tempLocation = this.config.get('thumbnailGenerator.tempLocation');
    this.tempZipLocation = `${this.tempLocation}/${this.config.get<string>('thumbnailGenerator.zipName')}`;
    this.thumbnailPresentorUrl = this.config.get('thumbnailGenerator.thumbnailPresentorUrl');
    this.targetIconId = this.config.get('thumbnailGenerator.targetIconId');
    this.tempScreenshotLocation = this.config.get('thumbnailGenerator.tempScreenshotLocation');
    this.watermarkTimeout = this.config.get('thumbnailGenerator.watermarkTimeout');
  }

  public async getLayerScreenshots(
    productType: string,
    productId: string,
    layerUrlWithMetadata: LayerUrlWithMetadata
  ): Promise<fsSync.ReadStream | undefined> {
    const { url, bbox, protocol } = layerUrlWithMetadata;
    const SELECTOR_TO_SCREENSHOT = 'body';
    const browser = container.resolve<Puppeteer.Browser>(BROWSER_CLIENT_TOKEN);
    const browserVP = container.resolve<BrowserViewPort>(BROWSER_VIEW_PORT);
    const browserEventHandlers = container.resolve<BrowserEventHandlers>(UTILS.BROWSER_EVENT_HANDLERS);
    const page = await browser.newPage();
    await page.setViewport({ width: browserVP.width, height: browserVP.height });

    // Puppeteer's browser event handlers
    page
      .on(PageEmittedEvents.Console, browserEventHandlers.consoleHandler)
      .on(PageEmittedEvents.PageError, browserEventHandlers.pageErrorHandler)
      .on(PageEmittedEvents.Response, browserEventHandlers.responseHandler)
      .on(PageEmittedEvents.RequestFailed, browserEventHandlers.requestFailedHandler)
      .on(PageEmittedEvents.RequestFinished, browserEventHandlers.requestFinishedHandler);

    try {
      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Generating thumbnails...`);
      const productProtocol = typeof protocol !== 'undefined' ? protocol as string : '';
      const thumbnailPresentorUrl = `${this.thumbnailPresentorUrl}/?url=${url}&productType=${productType}&bbox=${JSON.stringify(bbox)}&protocol=${productProtocol}`;
      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Requesting presentor url => ${thumbnailPresentorUrl}`);
      await fs.mkdir(this.tempScreenshotLocation, { recursive: true });
      await page.goto(thumbnailPresentorUrl);
      const thumbnails: Screenshot[] = [];
      await page.waitForSelector(this.targetIconId, { timeout: Number(this.watermarkTimeout) });
      const screenshotElement = await page.$(SELECTOR_TO_SCREENSHOT);
      const thumbnailBuffer = await screenshotElement?.screenshot({ type: 'png' });

      for (const [sizeName, thumbnailSize] of Object.entries(this.thumbnailSizes)) {
        const resizedThumbnailBuffer = await Sharp(thumbnailBuffer as Buffer)
          .resize({ ...thumbnailSize })
          .toBuffer();

        thumbnails.push({ buffer: resizedThumbnailBuffer, fileName: `${productId}-thumbnail-${sizeName}.png` });
      }

      await page.close();

      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Generating zip file for download.`);
      const zipReadStream = await this.createZipStream(thumbnails);

      return zipReadStream;

    } catch (e) {
      this.logger.error(`[PuppeteerOperations][getLayerScreenshots] There was an error creating the thumbnails. Error: ${e as string}`);
      await page.close();
      throw new Error('There was an error creating the thumbnails.');
    }
  }

  public async cleanTempFiles(): Promise<void> {
    this.logger.info(`[PuppeteerOperations][cleanTempFiles] Cleaning temp files.`);

    await fs.rm(this.tempLocation, { recursive: true });
  }

  private async createZipStream(thumbnails: Screenshot[]): Promise<fsSync.ReadStream> {
    return new Promise((resolve, reject) => {
      const writeable = fsSync.createWriteStream(this.tempZipLocation);
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      writeable.on('close', function () {
        const readStream = fsSync.createReadStream(writeable.path);
        resolve(readStream);
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          this.logger.warn(`[PuppeteerOperations][createZipStream] Generating zip warning: ${err.message}`);
        } else {
          reject(err.message);
        }
      });

      archive.pipe(writeable);

      for (const screenshot of thumbnails) {
        archive.append(screenshot.buffer, { name: screenshot.fileName });
      }

      void archive.finalize();
    });
  }
}

export default PuppeteerOperations;
