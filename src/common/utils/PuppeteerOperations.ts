import fs from 'fs/promises';
import fsSync from 'fs';
import Path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { Logger } from '@map-colonies/js-logger';
import Puppeteer from 'puppeteer';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../constants';
import { IConfig } from '../interfaces';

enum ThumbnailSizes {
  SMALL = 'sm',
  MEDIUM = 'md',
  LARGE = 'lg',
}

const TEMP_LOCATION = Path.resolve('src/common/temp');
const TARGET_ICON_ID = '#layerIcon';
const CESIUM_CONTAINER_ID = '#cesiumContainer';

@injectable()
class PuppeteerOperations {
  private readonly thumbnailSizes: Record<ThumbnailSizes, Puppeteer.Viewport>;
  // private readonly zipArchive: AdmZip;

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

    // this.zipArchive = new AdmZip(undefined);
  }

  public async getLayerScreenshots(
    recordUrl: string,
    bbox: number[] | undefined,
    productType: string,
    productId: string
  ): Promise<fsSync.ReadStream | undefined> {
    this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Launching Puppeteer's browser.`);

    const browser = await Puppeteer.launch({
      args: ['--disable-web-security', '--single-process'],
    });

    try {
      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Generating thumbnails...`);

      for (const [sizeName, viewPortSize] of Object.entries(this.thumbnailSizes)) {
        const page = await browser.newPage();
        await page.setViewport(viewPortSize);
        await page.goto(`http://localhost:4000/?url=${recordUrl}&productType=${productType}&bbox=${JSON.stringify(bbox)}`);
        console.log(`http://localhost:4000/?url=${recordUrl}&productType=${productType}&bbox=${JSON.stringify(bbox)}`);
        await page.waitForSelector(TARGET_ICON_ID);
        const cesiumElem = await page.$(CESIUM_CONTAINER_ID);
        await fs.mkdir(`${TEMP_LOCATION}/screenshots`, { recursive: true });
        await cesiumElem?.screenshot({ path: `${TEMP_LOCATION}/screenshots/${productId}-thumbnail-${sizeName}.png` });
      }
      // await this.zipArchive.addLocalFolderPromise(TEMP_SCREENSHOTS_LOCATION, {});
      await browser.close();
      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Generating zip file for download.`);
      // const zipBuffer = await this.zipArchive.toBufferPromise();
      const zipReadStream = await this.createZipStream();

      this.logger.info(`[PuppeteerOperations][getLayerScreenshots] Cleaning temp files.`);
      await fs.rm(`${TEMP_LOCATION}/screenshots`, { recursive: true });

      return zipReadStream;
    } catch (e) {
      this.logger.error(`[PuppeteerOperations][getLayerScreenshots] There was an error creating the thumbnails. Error: ${e as string}`);
      await browser.close();
      throw new Error('There was an error creating the thumbnails.');
    }
  }
  private async createZipStream(): Promise<fsSync.ReadStream> {
    return new Promise((resolve, reject) => {
      const writeable = fsSync.createWriteStream(`${TEMP_LOCATION}/thumbnails.zip`);
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Sets the compression level.
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
      archive.directory(`${TEMP_LOCATION}/screenshots`, false);
      
      void archive.finalize();
    });
  }
}

export default PuppeteerOperations;
