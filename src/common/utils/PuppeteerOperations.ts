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


const TEMP_SCREENSHOTS_LOCATION = '../src/common/temp/screenshots';
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

  public async getLayerScreenshots(): Promise<void> {
    const browser = await Puppeteer.launch({
      args: [
        '--disable-web-security',
      ]});
      try{
        for(const [sizeName, viewPortSize] of Object.entries(this.thumbnailSizes)){
        const page = await browser.newPage();
        await page.setViewport(viewPortSize);
        // await page.goto('http://localhost:4000/?url=/mock/tileset_1/tileset.json&type=3d');
        await page.goto('http://localhost:4000/?url=https://3d.ofek-air.com/3d/Jeru_Old_City_Cesium/ACT/Jeru_Old_City_Cesium_ACT.json&type=3d');
        // await page.goto('http://localhost:4000/?url=https://mapproxy-int-mapproxy-route-libot-integration.apps.v0h0bdx6.eastus.aroapp.io//wmts/demo_area_1-Orthophoto/libotGrid/%7BTileMatrix%7D/%7BTileCol%7D/%7BTileRow%7D.png/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicmVzb3VyY2VUeXBlcyI6WyJyYXN0ZXIiLCJkZW0iLCJ2ZWN0b3IiLCIzZCJdLCJkIjpbInJhc3RlciIsImRlbSIsInZlY3RvciIsIjNkIl0sImlhdCI6MTUxNjIzOTAyMn0.eGlm2er5oJUCOqNWA8bgi1QXoTSvtXD8lvRxcnN0BKY&type=raster');
        await page.waitForSelector(TARGET_ICON_ID);
        const cesiumElem = await page.$(CESIUM_CONTAINER_ID);
        await fs.mkdir(TEMP_SCREENSHOTS_LOCATION, { recursive: true });
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
