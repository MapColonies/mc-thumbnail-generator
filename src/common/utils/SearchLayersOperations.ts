import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { get } from 'lodash';
import axios from 'axios';
import { SERVICES } from '../constants';
import { IConfig } from '../interfaces';

@injectable()
class SearchLayersOperations {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(SERVICES.CONFIG) private readonly config: IConfig) {}

  public async getLayersForRecord(productType = 'RECORD_RASTER'): Promise<Record<string, unknown>> {
    const bffSearchQueryRes = await axios.post('http://localhost:8080/graphql', {
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
  }

  public async getLayerUrl(productId: string, productType: string): Promise<string> {
    const searchRecordsRes = await this.getLayersForRecord(productType);
    const relevantLayerMetadata = (get(searchRecordsRes, 'data.search') as Record<string, unknown>[]).find(
      (record) => record.productId === productId
    );
      console.log('here?', relevantLayerMetadata, 'productType', productType)
    if (productType !== 'RECORD_3D') {
      const linkWMTS = (get(relevantLayerMetadata, 'links') as Record<string, unknown>[]).find((link) => link.protocol === 'WMTS_LAYER');
      console.log('wmts', linkWMTS)
      const bffGetCapabilities = await axios.post('http://localhost:8080/graphql', {
        query:
          'query capabilities($params: CapabilitiesLayersSearchParams!) { capabilities(params: $params) {\n        __typename\nid\nstyle\nformat\ntileMatrixSet\nid\n\n      } }',
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
      console.log('layerCapability', layerCapability)


      const tileMatrixSet = ((get(layerCapability, 'data.capabilities') as Record<string, unknown>[])[0]?.tileMatrixSet as string[])[0];
      console.log('tileMatrixSet', tileMatrixSet)

      return (get(linkWMTS, 'url') as string).replace('{TileMatrixSet}', tileMatrixSet);
    }
    const link = (get(relevantLayerMetadata, 'links') as Record<string, unknown>[]).find((link) => link.protocol === '3DTiles')?.url as string;

    return link;
  }
}

export default SearchLayersOperations;
