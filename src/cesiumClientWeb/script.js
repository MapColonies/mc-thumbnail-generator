const config = globalThis.CONFIG;
const TOKEN = config.token;
const SEARCH_PARAMS = {
  URL_PARAM: 'url',
  PRODUCT_TYPE_PARAM: 'productType',
  BBOX_PARAM: 'bbox',
  RECORD_PROTOCOL: 'protocol'
};
const RECORD_PROTOCOLS = {
  WMTS_LAYER: 'WMTS_LAYER',
  XYZ_LAYER: 'XYZ_LAYER',
};
const DEFAULT_AOI_BBOX_POINTS = JSON.parse(
    config.defaultAOIBBoxPoints
);
const MIN_AOI_TO_BBOX_RATIO = 0.2;
const INJECTION_TYPE = config.injectionType;
const LOADING_TILES_TIMEOUT = parseInt(config.loadingTilesTimeout);
const Cesium3DTileContentState = { 
  UNLOADED:0,
  LOADING:1,
  PROCESSING:2,
  READY:3,
  EXPIRED:4,
  FAILED:5
};

const getAuthObject = () => {
  const tokenProps = {};
  if (INJECTION_TYPE.toLowerCase() === 'header') {
    tokenProps.headers = {
      'X-API-KEY': TOKEN,
    };
  } else if (INJECTION_TYPE.toLowerCase() === 'queryparam') {
    tokenProps.queryParameters = {
      token: TOKEN,
    };
  }
  return tokenProps;
};

// Setup Cesium viewer first.
const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayerPicker: false,
});

const ellipsoid = viewer.scene.mapProjection.ellipsoid;

// Remove stock cesium's base layer
viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
viewer.scene.globe.baseColor = Cesium.Color.WHITE;

viewer.animation.container.style.visibility = 'hidden';
viewer.timeline.container.style.visibility = 'hidden';
viewer.forceResize();

// Helpers
const tilesLoadedPromise = () => {
  return new Promise((resolve, reject) => {
    const tilesInterval = setInterval(() => {
      const tilesLoaded = viewer.scene.globe.tilesLoaded;
      if (tilesLoaded) {
        clearInterval(tilesInterval);
        resolve(tilesLoaded);
      }
    }, 500);
  });
};

const tilesetLoadedPromise = (tileset) => {
  return new Promise((resolve)=>{
    const loadingTilesTimeout = setTimeout(()=>resolve(true), LOADING_TILES_TIMEOUT);
    tileset.allTilesLoaded.addEventListener(()=> {
      // console.log('_selectedTiles tilesetLoadedPromise--->', tileset.root.content.tile.content.tileset._selectedTiles); 
      clearTimeout(loadingTilesTimeout);
      resolve(true);
    });
  })
};

function getParameterByName(name) {
  const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });

  return params[name];
}

const appendIconByProductType = (productType) => {
  let iconClassName;

  switch (productType) {
    case 'RECORD_3D':
      iconClassName = 'mc-icon-Map-3D';
      break;
    case 'RECORD_RASTER':
      iconClassName = 'mc-icon-Map-Orthophoto';
      break;
    default:
      iconClassName = 'mc-icon-Map-Raster';
      break;
  }

  const iconSpan = document.createElement('span');
  iconSpan.classList.add(iconClassName);
  iconSpan.id = 'layerIcon';

  document.querySelector('#cesiumContainer').appendChild(iconSpan);
};

const getExtentRect = () => {
  const computedExtentRect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);

  return computedExtentRect;
};

const getExtentSize = () => {
  const extent = getExtentRect();
  const NE = Cesium.Cartographic.toCartesian(Cesium.Rectangle.northeast(extent));
  const SW = Cesium.Cartographic.toCartesian(Cesium.Rectangle.southwest(extent));

  return Cesium.Cartesian3.distance(NE, SW) / 1000; // To get KM distance;
};

const getCameraHeight = () => {
  const height = ellipsoid.cartesianToCartographic(viewer.camera.position).height;

  return Math.round(height * 0.001); // KM
};

const setCameraToProperHeightAndPos = (tryNum = 0) => {
  let cameraHeight = viewer.scene.primitives.get(0).boundingSphere.radius;

  cameraHeight *= (1.3 - tryNum * 0.2); // Calulate camera height 
  // For debugging 
  // console.log("bounding sphere radius-->", viewer.scene.primitives.get(0).boundingSphere.radius);
  // console.log("camera height-->", range);
  viewer.camera.lookAt(
    viewer.scene.primitives.get(0).boundingSphere.center,
    new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), cameraHeight)
  );

  return Promise.resolve(true);
};

const getLayerBBoxArea = (bbox) => {
  const bboxPolygon = turf.bboxPolygon(bbox);
  return turf.area(bboxPolygon);
};

const getAOIBBox = () => {
  if (!DEFAULT_AOI_BBOX_POINTS) return;

  const lineString = turf.lineString(DEFAULT_AOI_BBOX_POINTS);
  const defaultBBox = turf.bbox(lineString);

  return defaultBBox;
};

const getAOIBBoxPolygon = () => {
  if (!DEFAULT_AOI_BBOX_POINTS) return;

  const bboxPolygon = turf.bboxPolygon(getAOIBBox());

  return bboxPolygon;
};

const getAOIBBoxArea = () => {
  if (!DEFAULT_AOI_BBOX_POINTS) return;

  const AOIBBox = getAOIBBoxPolygon();

  return turf.area(AOIBBox);
};

const getSuitableBBox = (layerBBox) => {
  const layerBBoxArea = getLayerBBoxArea(layerBBox);
  const AOIBBoxArea = getAOIBBoxArea();

  if (!AOIBBoxArea) return layerBBox;

  const AOIToBBoxRatio = AOIBBoxArea / layerBBoxArea;

  const AOIPolygon = getAOIBBoxPolygon();
  const bboxPolygon = turf.bboxPolygon(layerBBox);

  const isBBOXContainsAOI = turf.booleanContains(bboxPolygon, AOIPolygon);

  if (isBBOXContainsAOI && AOIToBBoxRatio < MIN_AOI_TO_BBOX_RATIO) {
    return getAOIBBox();
  }

  return layerBBox;
};

// Debugging Helpers

const drawLayerRectangle = (rectangle, color = false) => {
    // Color argument should be of cesium colors e.g => Cesium.Color.YELLOW.withAlpha(0.5)
    // default is red.

    const rectPrimitive = viewer.scene.primitives.add(new Cesium.Primitive({
    geometryInstances : new Cesium.GeometryInstance({
        geometry : new Cesium.RectangleGeometry({
            rectangle
        })
    }),
    appearance : new Cesium.EllipsoidSurfaceAppearance({
        aboveGround : false,
        material: Cesium.Material.fromType('Color')
    })
  }));

  if(color) {
    rectPrimitive.appearance.material.uniforms.color = color;
  }

}

const drawModelBoundingSphere = (boundingSphere, color = false) => {
  // Color argument should be of cesium colors e.g => Cesium.Color.YELLOW.withAlpha(0.5)

  viewer.entities.add({
    name: 'Bounding Sphere',
    position: boundingSphere.center,
    ellipsoid: {
      radii:  new Cesium.Cartesian3(boundingSphere.radius, boundingSphere.radius, boundingSphere.radius),
      material: color || Cesium.Color.RED.withAlpha(0.5),
      outline: true,
      outlineColor: Cesium.Color.BLACK,
    },
  });
}

// --------

const url = getParameterByName(SEARCH_PARAMS.URL_PARAM);
const productType = getParameterByName(SEARCH_PARAMS.PRODUCT_TYPE_PARAM);
const bbox = getParameterByName(SEARCH_PARAMS.BBOX_PARAM);
const recordProtocol = getParameterByName(SEARCH_PARAMS.RECORD_PROTOCOL);

const render3DTileset = async () => {
  let tryNum = 0;
  viewer.camera.moveEnd.addEventListener(() => {
    // const tp = viewer.scene.globe._surface._tilesToRender;
    // console.log('tileset._tilesToRender--->', tp); 
    // if(tp.length > 0){
    //   console.log("level:" + tp[0].level);
    // }
    
    const initialValue = Cesium3DTileContentState.UNLOADED;
    const sumWithInitial = tileset.root.children.reduce(
      (previousValue, current) => {
        return previousValue + current._contentState;
      },
      initialValue
    );
    
    // All contents are in UNLOADED state then zoom-in
    if(sumWithInitial === Cesium3DTileContentState.UNLOADED){
      setCameraToProperHeightAndPos(tryNum++);
    }
  });

  const tileset = viewer.scene.primitives.add(
    new Cesium.Cesium3DTileset({
        // debugShowContentBoundingVolume: true,
        url: new Cesium.Resource({
          url,
          ...getAuthObject()
        })
      })
  );
 
  await new Promise(resolve => {
    tileset.readyPromise.then(() => {
      viewer.camera.flyToBoundingSphere(tileset.boundingSphere,{
        duration: 0,
        complete: ()=> {
          setCameraToProperHeightAndPos();
          resolve(true);
        }
      })
    }).finally(() => {
      // Drawing model's Bounding Sphere for debugging
      // drawModelBoundingSphere(tileset.boundingSphere);
    });
  });

  return tilesetLoadedPromise(tileset);
};

const renderRasterLayer = () => {
  viewer.scene.mode = Cesium.SceneMode.SCENE2D;

  const rectWithBuffers = Cesium.Rectangle.fromDegrees(...getSuitableBBox(JSON.parse(bbox)));
  rectWithBuffers.east = rectWithBuffers.east + rectWithBuffers.width * 0.5;
  rectWithBuffers.west = rectWithBuffers.west - rectWithBuffers.width * 0.5;

  let provider = null;

  switch (recordProtocol) {
    case RECORD_PROTOCOLS.WMTS_LAYER:
      provider = new Cesium.WebMapTileServiceImageryProvider({
        url: new Cesium.Resource({
          url,
          ...getAuthObject(),
        }),
        rectangle: rectWithBuffers,
        tilingScheme: new Cesium.GeographicTilingScheme(),
      });
      break;

    case RECORD_PROTOCOLS.XYZ_LAYER:
      provider = new Cesium.UrlTemplateImageryProvider({
        url: new Cesium.Resource({
          url,
          ...getAuthObject(),
        }),
        rectangle: rectWithBuffers,
      });
      break;
  }

  return new Promise((resolve, reject) => {
    if (provider) {
      viewer.imageryLayers.addImageryProvider(provider);
      const rectangle = Cesium.Rectangle.fromDegrees(...getSuitableBBox(JSON.parse(bbox)));

      // Drawing Layer's rectangle for debugging
      // drawLayerRectangle(rectangle);

      viewer.camera.flyTo({
        destination: rectangle,
        duration: 0,
        complete: resolve,
      });
    } else {
      reject('There was an error creating the provider.');
    }
  });
};

// Render products

switch (productType) {
  case 'RECORD_3D': {
    render3DTileset()
            .then(() => {
              appendIconByProductType('RECORD_3D');
            });

    break;
  }
  case 'RECORD_RASTER': {
    renderRasterLayer()
      .then(tilesLoadedPromise)
      .then(() => appendIconByProductType('RECORD_RASTER'))
      .catch((e) => console.error(e));

    break;
  }

  default:
    break;
}

// --------
