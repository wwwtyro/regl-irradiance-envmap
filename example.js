"use strict";

const glsl = require("glslify");
const REGL = require("regl");
const createCube = require("primitive-cube");
const unindex = require("unindex-mesh");
const mat4 = require("gl-matrix").mat4;
const renderEnvMap = require("regl-render-envmap");
const createAtmosphereRenderer = require("regl-atmosphere-envmap");
const createIrradianceRenderer = require("./index");

const regl = REGL();

const cube = unindex(createCube(1));

const renderAtmosphere = createAtmosphereRenderer(regl);
const envMap = renderAtmosphere({
  sunDirection: [0, 0.25, 1],
});

const renderIrradiance = createIrradianceRenderer(regl);
const irradianceMap = renderIrradiance(envMap);

const noiseCommand = regl({
  vert: glsl`
    precision highp float;
    attribute vec3 position;
    uniform mat4 view, projection;
    varying vec3 pos;
    void main() {
      gl_Position = projection * view * vec4(position, 1);
      pos = position;
    }
  `,
  frag: glsl`
    precision highp float;
    uniform samplerCube envMap;
    varying vec3 pos;

    #pragma glslify: noise = require('glsl-noise/simplex/3d')

    void main() {
      vec3 dir = normalize(pos);
      float n = noise(dir * vec3(2.0, 2.0, 2.0));
      n = 1.0 - abs(n);
      gl_FragColor = vec4(n,n,n, 1);
    }
  `,
  attributes: {
    position: cube,
  },
  uniforms: {
    view: regl.prop("view"),
    projection: regl.prop("projection"),
    envMap: regl.prop("envMap"),
  },
  framebuffer: regl.prop("framebuffer"),
  viewport: regl.prop("viewport"),
  count: cube.length / 3,
});

const noiseMap = renderEnvMap(
  regl,
  function(config) {
    regl.clear({
      depth: 1,
      framebuffer: config.framebuffer,
    });
    noiseCommand({
      view: config.view,
      projection: config.projection,
      envMap: envMap,
      viewport: config.viewport,
      framebuffer: config.framebuffer,
    });
  },
  {
    resolution: 1024,
  }
);

const skyboxCommand = regl({
  vert: glsl`
    precision highp float;
    attribute vec3 position;
    uniform mat4 model, view, projection;
    varying vec3 pos;
    void main() {
      gl_Position = projection * view * model * vec4(position, 1);
      pos = position;
    }
  `,
  frag: glsl`
    precision highp float;
    uniform samplerCube envMap;
    varying vec3 pos;
    void main() {
      gl_FragColor = textureCube(envMap, normalize(pos));
    }
  `,
  attributes: {
    position: cube,
  },
  uniforms: {
    model: regl.prop("model"),
    view: regl.prop("view"),
    projection: regl.prop("projection"),
    envMap: regl.prop("envMap"),
  },
  viewport: regl.prop("viewport"),
  count: cube.length / 3,
});

const sphereCommand = regl({
  vert: glsl`
    precision highp float;
    attribute vec3 position;
    uniform mat4 model, view, projection;
    varying vec3 pos;
    void main() {
      gl_Position = projection * view * model * vec4(position, 1);
      pos = position;
    }
  `,
  frag: glsl`
    precision highp float;
    uniform samplerCube irradianceMap, envMap, noiseMap;
    uniform vec3 campos;
    varying vec3 pos;

    bool raySphereIntersect(vec3 r0, vec3 rd, vec3 s0, float sr, out float t) {
      vec3 s0_r0 = r0 - s0;
      float b = 2.0 * dot(rd, s0_r0);
      float c = dot(s0_r0, s0_r0) - (sr * sr);
      float d = b * b - 4.0 * c;
      if (d < 0.0) return false;
      t = (-b - sqrt(d))*0.5;
      return t >= 0.0;
    }

    void main() {
      vec3 dir = normalize(pos - campos);
      float t;
      if (!raySphereIntersect(campos, dir, vec3(0,0,0), 0.5, t)) discard;
      vec3 p = normalize(campos + t * dir);
      float m = textureCube(noiseMap, p).r;
      vec4 irradianceMapColor = textureCube(irradianceMap, p);
      vec3 r = reflect(dir, p);
      vec4 envMapColor = textureCube(envMap, r);
      float s = step(0.9, m);
      gl_FragColor = (1.0 - s) * irradianceMapColor + s * envMapColor;
    }
  `,
  attributes: {
    position: cube,
  },
  uniforms: {
    model: regl.prop("model"),
    view: regl.prop("view"),
    projection: regl.prop("projection"),
    irradianceMap: regl.prop("irradianceMap"),
    envMap: regl.prop("envMap"),
    noiseMap: regl.prop("noiseMap"),
    campos: regl.prop("campos"),
  },
  viewport: regl.prop("viewport"),
  count: cube.length / 3,
});

const canvas = document.getElementsByTagName("canvas")[0];

const cam = {
  theta: 0,
  phi: 0,
  radius: 2,
  user: false,
};

function handleMouseMove(e) {
  cam.phi += e.movementY * 0.001;
  cam.phi = Math.min(
    Math.max(-0.999 * Math.PI / 2, cam.phi),
    0.999 * Math.PI / 2
  );
  cam.theta += e.movementX * 0.001;
}

document.addEventListener("pointerlockchange", function() {
  if (document.pointerLockElement === canvas) {
    canvas.addEventListener("mousemove", handleMouseMove);
  } else {
    canvas.removeEventListener("mousemove", handleMouseMove);
  }
});

canvas.addEventListener("mousedown", function() {
  canvas.requestPointerLock();
  cam.user = true;
});

canvas.addEventListener("mouseup", function() {
  document.exitPointerLock();
  cam.user = false;
});

let count = 0;

function loop() {
  if (!cam.user) {
    cam.theta += Math.PI * 2 / 600;
    cam.phi;
  }
  const campos = [
    Math.cos(cam.theta) * Math.cos(cam.phi) * cam.radius,
    Math.sin(cam.phi) * cam.radius,
    Math.sin(cam.theta) * Math.cos(cam.phi) * cam.radius,
  ];
  let model = mat4.scale([], mat4.create(), [1000, 1000, 1000]);
  const view = mat4.lookAt([], campos, [0, 0, 0], [0, 1, 0]);
  const projection = mat4.perspective(
    [],
    Math.PI / 3,
    canvas.width / canvas.height,
    0.1,
    1000
  );

  regl.clear({
    color: [1, 1, 1, 1],
    depth: 1,
  });

  skyboxCommand({
    model: model,
    view: view,
    projection: projection,
    envMap: envMap,
    viewport: {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    },
  });

  model = mat4.create();

  sphereCommand({
    model: model,
    view: view,
    projection: projection,
    campos: campos,
    irradianceMap: irradianceMap,
    envMap: envMap,
    noiseMap: noiseMap,
    viewport: {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    },
  });

  requestAnimationFrame(loop);
}

loop();
