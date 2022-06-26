import fs from 'fs/promises';
import fsSync from 'fs';
import archiver from 'archiver';
import { Logger } from '@map-colonies/js-logger';
import Puppeteer from 'puppeteer';
import Sharp from 'sharp';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../constants';
import { IConfig } from '../interfaces';

enum ThumbnailSizes {
  SMALL = 'sm',
  MEDIUM = 'md',
  LARGE = 'lg',
}

interface Screenshot {
  buffer: Buffer;
  fileName: string;
}
@injectable()
class PuppeteerOperations {
  private readonly tempLocation: string;
  private readonly tempZipLocation: string;
  private readonly thumbnailPresentorUrl: string;
  private readonly targetIconId: string;
  private readonly cesiumContainerId: string;
  private readonly thumbnailSizes: Record<ThumbnailSizes, Puppeteer.Viewport>;
  private readonly tempScreenshotLocation: string;

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
    this.cesiumContainerId = this.config.get('thumbnailGenerator.cesiumContainerId');
    this.tempScreenshotLocation = this.config.get('thumbnailGenerator.tempScreenshotLocation');
  }

  public async getLayerScreenshots(
    recordUrl: string,
    bbox: number[] | undefined,
    productType: string,
    productId: string
  ): Promise<fsSync.ReadStream | undefined> {
    this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Launching Puppeteer's browser.`);

    const viewPortSize = {
      width: 800,
      height: 800
    }

    const browser = await Puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      args: ['--disable-web-security', '--single-process', `--window-size=${viewPortSize.width},${viewPortSize.height}`],
      userDataDir: './browser-cache',
    });

    try {
      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Generating thumbnails...`);

      const thumbnailPresentorUrl = `${this.thumbnailPresentorUrl}/?url=${recordUrl}&productType=${productType}&bbox=${JSON.stringify(bbox)}`;
      await fs.mkdir(this.tempScreenshotLocation, { recursive: true });
      const page = await browser.newPage();
      await page.goto(thumbnailPresentorUrl);
      const thumbnails: Screenshot[] = [];
      await page.waitForSelector(this.targetIconId, { timeout: 90000 });
      const cesiumElem = await page.$(this.cesiumContainerId);
      const thumbnailBuffer = await cesiumElem?.screenshot({ type: 'png' });

      for (const [sizeName, thumbnailSize] of Object.entries(this.thumbnailSizes)) {
        const resizedThumbnailBuffer = await Sharp(thumbnailBuffer as Buffer).resize({...thumbnailSize}).toBuffer();

        thumbnails.push({ buffer: resizedThumbnailBuffer, fileName: `${productId}-thumbnail-${sizeName}.png` });
      }

      await browser.close();

      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Generating zip file for download.`);
      const zipReadStream = await this.createZipStream(thumbnails);

      return zipReadStream;
    } catch (e) {
      this.logger.error(`[PuppeteerOperations][getLayerScreenshots] There was an error creating the thumbnails. Error: ${e as string}`);
      await browser.close();
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
