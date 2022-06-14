import fs from "fs/promises";
import Path from 'path';
import { Logger } from '@map-colonies/js-logger';
import Puppeteer from 'puppeteer';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../constants';
import { IConfig } from '../interfaces';

enum ThumbnailSizes {
  SMALL = 'sm',
  MEDIUM = 'md',
  LARGE = 'lg'
}


const TEMP_SCREENSHOTS_LOCATION = 'src/common/temp/screenshots';
const TARGET_ICON_ID = '#layerIcon';
const CESIUM_CONTAINER_ID = '#cesiumContainer';


@injectable()
class PuppeteerOperations {
  private readonly thumbnailSizes: Record<ThumbnailSizes, Puppeteer.Viewport>;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    
    this.thumbnailSizes = {
      [ThumbnailSizes.SMALL]: {
        width: 400,
        height: 400
      },
      [ThumbnailSizes.MEDIUM]: {
        width: 600,
        height: 600
      },
      [ThumbnailSizes.LARGE]: {
        width: 800,
        height: 800
      }
    }
  }

  public async getLayerScreenshots(recordUrl: string, productType: string): Promise<void> {
    const browser = await Puppeteer.launch({
      args: [
        '--disable-web-security',
      ]});
      try{
        for(const [sizeName, viewPortSize] of Object.entries(this.thumbnailSizes)){
        const page = await browser.newPage();
        await page.setViewport(viewPortSize);
        await page.goto(`http://localhost:4000/?url=${recordUrl}&productType=${productType}`);
        await page.waitForSelector(TARGET_ICON_ID);
        const cesiumElem = await page.$(CESIUM_CONTAINER_ID);
        await fs.mkdir(Path.resolve(TEMP_SCREENSHOTS_LOCATION), { recursive: true });
        await cesiumElem?.screenshot({ path: `${TEMP_SCREENSHOTS_LOCATION}/model-thumbnail-${sizeName}.png` });
      }
      await browser.close();
  }catch(e) {
      console.error(e);
      await browser.close();
  }
  }
}

export default PuppeteerOperations;
