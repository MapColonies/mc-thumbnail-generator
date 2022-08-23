import config from 'config';
import Puppeteer from 'puppeteer';
import { logMethod } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { Metrics } from '@map-colonies/telemetry';
import { SERVICES, SERVICE_NAME, UTILS } from './common/constants';
import { tracing } from './common/tracing';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import PuppeteerOperations from './common/utils/PuppeteerOperations';
import { GET_THUMBNAIL_GENERATOR_ROUTER_SYMBOL, getThumbnailGeneratorRouterFactory } from './thumbnailGenerator/routes/getThumbnailGeneratorRouter';
import SearchLayersOperations from './common/utils/SearchLayersOperations';
import BrowserEventHandlers from './common/utils/BrowserEventHandlers';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const BROWSER_CLIENT_TOKEN = Symbol('BROWSER_CLIENT');
export const BROWSER_VIEW_PORT = Symbol('BROWSER_VIEW_PORT');

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // @ts-expect-error the signature is wrong
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });

  const metrics = new Metrics(SERVICE_NAME);
  const meter = metrics.start();

  tracing.start();
  const tracer = trace.getTracer(SERVICE_NAME);

  const puppeteerOps = new PuppeteerOperations(logger, config);
  const searchLayerOps = new SearchLayersOperations(logger, config);
  const browserEventHandlers = new BrowserEventHandlers(logger);

  const viewPortSize = {
    width: 800,
    height: 800,
  };

  logger.info(`[PuppeteerOperations][getLayerScreenshots] Launching Puppeteer's browser.`);

  const browserClient = await Puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--disable-web-security', '--single-process', `--window-size=${viewPortSize.width},${viewPortSize.height}`],
    userDataDir: './browser-cache',
  });

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    { token: SERVICES.METER, provider: { useValue: meter } },
    { token: SERVICES.PUPPETEER_OPERATIONS, provider: { useValue: puppeteerOps } },
    { token: UTILS.BROWSER_EVENT_HANDLERS, provider: { useValue: browserEventHandlers } },
    { token: SERVICES.SEARCH_LAYER_OPERATIONS, provider: { useValue: searchLayerOps } },
    { token: BROWSER_CLIENT_TOKEN, provider: { useValue: browserClient } },
    { token: BROWSER_VIEW_PORT, provider: { useValue: viewPortSize } },
    { token: GET_THUMBNAIL_GENERATOR_ROUTER_SYMBOL, provider: { useFactory: getThumbnailGeneratorRouterFactory } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop(), metrics.stop()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
