import BBox from '@turf/bbox';
import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { get } from 'lodash';
import axios from 'axios';
import { SERVICES } from '../constants';
import { IConfig } from '../interfaces';
import { ProductType } from '../../thumbnailGenerator/models/ProductType';
import { Protocols } from '../../thumbnailGenerator/models/Protocols';

@injectable()
class SearchLayersOperations {
  private readonly bffUrl: string;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {
    this.bffUrl = this.config.get('thumbnailGenerator.bffUrl');
  }

  public async getLayersForRecord(productType: ProductType): Promise<Record<string, unknown>> {
    this.logger.info(`[SearchLayersOperations][getLayersForRecord] Searching layers for product ${productType}`);
    try {
      const bffSearchQueryRes = await axios.post(this.bffUrl, {
        query:
          'query search($opts: SearchOptions, $end: Float, $start: Float) { search(opts: $opts, end: $end, start: $start) {\n__typename\n... on Layer3DRecord {\n\n__typename\nid\ntype\nproductId\nfootprint\nlinks {\n\n__typename\nname\ndescription\nprotocol\nurl\n\n}\n\n}\n... on LayerRasterRecord {\n\n__typename\nid\ntype\nproductId\nfootprint\nlinks {\n\n__typename\nname\ndescription\nprotocol\nurl\n\n}\n\n}\n\n... on LayerDemRecord {\n\n__typename\nid\ntype\nproductId\nfootprint\nlinks {\n\n__typename\nname\ndescription\nprotocol\nurl\n\n}\n\n}} }',
        variables: {
          opts: {
            filter: [
              {
                field: 'mc:type',
                eq: productType,
              },
            ],
          },
          end: 1000,
          start: 1,
        },
      });

      return bffSearchQueryRes.data as Record<string, unknown>;
    } catch (e) {
      this.logger.error(`[SearchLayersOperations][getLayersForRecord] There was an error getting records for product ${productType}.`);
      throw new Error(`There was an error getting records for product ${productType}.`);
    }
  }

  public async getLayerUrl(productId: string, productType: ProductType): Promise<{ url: string; bbox?: number[] }> {
    try {
      this.logger.info(`[SearchLayersOperations][getLayerUrl] Gatting url for layer '${productId}'.`);

      const searchRecordsRes = await this.getLayersForRecord(productType);
      const relevantLayerMetadata = (get(searchRecordsRes, 'data.search') as Record<string, unknown>[]).find(
        (record) => record.productId === productId
      );

      const bbox = BBox(get(relevantLayerMetadata, 'footprint'));

      if (productType !== ProductType.RECORD_3D) {
        const linkWMTS = (get(relevantLayerMetadata, 'links') as Record<string, unknown>[]).find(
          (link) => link.protocol === Protocols.RASTER_LAYER_PROTOCOL
        );

        const bffGetCapabilities = await axios.post(this.bffUrl, {
          query:
            'query capabilities($params: CapabilitiesLayersSearchParams!) { capabilities(params: $params) {\n__typename\nid\nstyle\nformat\ntileMatrixSet\nid\n\n}}',
          variables: {
            params: {
              data: [
                {
                  recordType: productType,
                  idList: [get(linkWMTS, 'name') as string],
                },
              ],
            },
          },
        });

        const layerCapability = bffGetCapabilities.data as Record<string, unknown>;
        const tileMatrixSet = ((get(layerCapability, 'data.capabilities') as Record<string, unknown>[])[0]?.tileMatrixSet as string[])[0];
        const url = (get(linkWMTS, 'url') as string).replace('{TileMatrixSet}', tileMatrixSet);

        return { url, bbox };
      }
      const url = (get(relevantLayerMetadata, 'links') as Record<string, unknown>[]).find((link) =>
        [Protocols.TILESET_3D_LAYER_PROTOCOL, Protocols.TILESET_3D_PROTOCOL].includes(link.protocol as Protocols)
      )?.url as string;

      return { url, bbox };
    } catch (e) {
      this.logger.error(`[SearchLayersOperations][getLayerUrl] There was an error targeting the requested product '${productId}'.`);
      throw new Error(`There was an error targeting the requested product '${productId}'.`);
    }
  }
}

export default SearchLayersOperations;
