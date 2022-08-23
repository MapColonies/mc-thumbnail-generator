import { Logger } from '@map-colonies/js-logger';
import { ConsoleMessage, HTTPRequest, HTTPResponse } from 'puppeteer';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../constants';

@injectable()
export default class BrowserEventHandlers {
  /**
   * Util class used to handle Puppeteer's browser events.
   */
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger) {}

  public consoleHandler = (message: ConsoleMessage): void => {
    const SUBSTR_LENGTH = 3;
    this.logger.info(`[PuppeteerBrowserEvent][console] ${message.type().substring(0, SUBSTR_LENGTH).toUpperCase()} ${message.text()}`);
  };
  
  public pageErrorHandler = (err: Error): void => {
    this.logger.error(`[PuppeteerBrowserEvent][pageError] ${err.message}`);
  };
  
  public responseHandler = (res: HTTPResponse): void => {
    this.logger.info(`[PuppeteerBrowserEvent][response] ${res.status()} ${res.url()}`)
  };
  
  public requestFailedHandler = (request: HTTPRequest): void => {
    const resStatus = request._response?.status();
    this.logger.error(`[PuppeteerBrowserEvent][requestFailed] ${resStatus ?? ''} ${request.failure()?.errorText ?? ''} ${request.url()}`)
  };
  
  public requestFinishedHandler = (request: HTTPRequest): void => {
    const MINIMUM_CODE_FOR_BAD_RES = 400;
    const resStatus = request._response?.status();

    if(typeof resStatus !== 'undefined' && resStatus >= MINIMUM_CODE_FOR_BAD_RES) {
        this.logger.error(`[PuppeteerBrowserEvent][requestFinished] ${resStatus} ${request.failure()?.errorText ?? ''} ${request.url()}`)
    }
  };
}

