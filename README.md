# regl-irradiance-envmap

Easily generate an irradiance environment map from an existing environment map.

<p align="center">
  <img src="https://github.com/wwwtyro/regl-irradiance-envmap/raw/media/irradiance.gif" width="100%">
</p>

[Demo](https://wwwtyro.github.io/regl-irradiance-envmap/)

## Install

```
npm install regl-irradiance-envmap
```

## Usage

```js
const createIrradianceRenderer = require("regl-irradiance-envmap");

const renderIrradiance = createIrradianceRenderer(regl);

const irradianceMap = renderIrradiance(envMap, opts);
```

`createIrradianceRenderer` takes a regl context as a parameter, and returns the function `renderIrradiance`.

`renderIrradiance` takes an `envMap` and `opts` parameter and returns a regl `framebufferCube` object that can be
immediately used as a `samplerCube` in your shaders, or passed back into the `renderIrradiance` function to update it.

The `envMap` parameter is a regl `framebufferCube` or `cube` (cubemap) object that you provide.

The `opts` parameter is an object with the following (optional) members:

* **samples**: The number of random samples to take for each pixel in the environment map, int, 128
* **diffusivity**: How diffuse the sample rays are. 0.0 is perfectly reflective, 1.0 is perfectly diffusive, float, default 0.5
* **resolution**: The resolution of each square face of the environment cubemap if `cubeFBO` is not provided, int, default 128
* **cubeFBO**: The regl `framebufferCube` object that will be returned, default `regl.framebufferCube(opts.resolution)`
