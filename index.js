"use strict";

const createCube = require("primitive-cube");
const unindex = require("unindex-mesh");
const vec3 = require("gl-matrix").vec3;
const renderEnvMap = require("regl-render-envmap");

module.exports = function(regl) {
  const cube = unindex(createCube(1));

  const sampleDirTexture = regl.texture();

  const irradianceCommand = regl({
    vert: `
      precision highp float;
      attribute vec3 position;
      uniform mat4 view, projection;
      varying vec3 pos;
      void main() {
        gl_Position = projection * view * vec4(position, 1);
        pos = position;
      }
    `,
    frag: `
      precision highp float;
      uniform samplerCube envMap;
      uniform sampler2D sampleDir;
      uniform int samples;
      uniform float diffusivity;
      varying vec3 pos;
      void main() {
        vec3 dir = normalize(pos);
        vec3 sum = vec3(0.0);
        float q = 0.0;
        for (int i = 0; i < 16384; i++) {
          if (i >= samples) break;
          vec3 r = texture2D(sampleDir, vec2(float(i)/float(samples), 0.5)).rgb;
          r = normalize(r * 2.0 - 1.0);
          vec3 newdir = dir + r * diffusivity;
          float weight = dot(newdir, dir);
          q += weight;
          sum += textureCube(envMap, newdir).rgb * weight;
        }
        gl_FragColor = vec4(sum/q, 1);
      }
    `,
    attributes: {
      position: cube,
    },
    uniforms: {
      view: regl.prop("view"),
      projection: regl.prop("projection"),
      envMap: regl.prop("envMap"),
      sampleDir: sampleDirTexture,
      samples: regl.prop("samples"),
      diffusivity: regl.prop("diffusivity"),
    },
    framebuffer: regl.prop("framebuffer"),
    viewport: regl.prop("viewport"),
    count: cube.length / 3,
  });

  function render(envMap, opts) {
    opts = opts || {};
    opts.resolution = opts.resolution === undefined ? 128 : opts.resolution;
    opts.samples = opts.samples === undefined ? 128 : opts.samples;
    opts.diffusivity = opts.diffusivity === undefined ? 0.5 : opts.diffusivity;

    const sampleDirData = [];
    for (let i = 0; i < opts.samples; i++) {
      const r = vec3.random([], 1.0);
      sampleDirData.push(Math.floor(r[0] * 128 + 128));
      sampleDirData.push(Math.floor(r[1] * 128 + 128));
      sampleDirData.push(Math.floor(r[2] * 128 + 128));
    }

    sampleDirTexture({
      width: opts.samples,
      height: 1,
      format: "rgb",
      data: sampleDirData,
    });

    return renderEnvMap(
      regl,
      function(config) {
        regl.clear({
          depth: 1,
          framebuffer: config.framebuffer,
        });
        irradianceCommand({
          view: config.view,
          projection: config.projection,
          envMap: envMap,
          samples: opts.samples,
          diffusivity: opts.diffusivity,
          viewport: config.viewport,
          framebuffer: config.framebuffer,
        });
      },
      {
        resolution: opts.resolution,
        cubeFBO: opts.cubeFBO,
      }
    );
  }

  return render;
};
