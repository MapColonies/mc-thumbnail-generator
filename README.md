# MC Thumbnail Generator

Generates a thumbnail to a given geo (raster/3d/dem) layer

Checkout the OpenAPI spec [here](/openapi3.yaml)

## Installation

Install deps with npm

```bash
npm install
```
### Install Git Hooks
```bash
npx husky install
```

## Run Locally

Clone the project

```bash
git clone git@github.com:MapColonies/mc-thumbnail-generator.git
```

Go to the project directory

```bash
cd mc-thumbnail-generator
```

Install dependencies

```bash
npm install
```

Start the server

```bash
npm run start
```

## Running Tests

To run tests, run the following command

```bash
npm run test
```

To only run unit tests:
```bash
npm run test:unit
```

To only run integration tests:
```bash
npm run test:integration
```

## Deployment

> [!IMPORTANT] 
> We depend on `Red-Hat Yaml Extention` for validating the values files against the relevant schemas from helm-common.
> That means, you should install the extention from vscode in order to be able to edit values files according to our schemas.
  
To update helm dependencies
```bash
npm run helm-update
```

In order to create/renew values schemas 
```bash
npm run helm-assets
```

To deploy: helm values **MUST** be combined from global.yaml and values.yaml (use npm script!)
```bash
npm run helm-install
```

See [helm values](https://github.com/MapColonies/helm-common/blob/c352a2453117895ec0f9df0267a66d6f5b9c2da2/README.md)
