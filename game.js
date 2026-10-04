"use strict";

/*
  BlockWorld
  Eigenes Voxel-Spiel mit Three.js.
  Es verwendet keine Original-Minecraft-Assets.
*/

/* =========================================================
   EINSTELLUNGEN
========================================================= */

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 32;
const VIEW_DISTANCE = 2;
const SEA_LEVEL = 6;

const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.3;
const REACH = 6;

const CHUNK_INTERVAL = 1.2;
const WATER_INTERVAL = 0.9;
const LAVA_INTERVAL = 1.4;

let seed = Math.floor(
  Math.random() * 999999999
);

let scene;
let camera;
let renderer;
let clock;
let worldGroup;

let world = new Map();
let chunks = new Map();
let chunkMeshes = new Map();
let textureCache = new Map();

let gameActive = false;
let gamePaused = false;
let inventoryOpen = false;
let pointerLocked = false;

let selected = 0;
let yaw = 0;
let pitch = 0;

let waterTimer = 0;
let lavaTimer = 0;
let chunkTimer = 0;
let worldDirty = true;

let frameCounter = 0;
let frameTimer = 0;
let fps = 0;

const keys = {};
const touchKeys = {};

const velocity = new THREE.Vector3();
const move = new THREE.Vector3();
const side = new THREE.Vector3();

const player = {
  position: new THREE.Vector3(0, 18, 0),
  speed: 5,
  sprint: 7.5,
  jump: 8.2,
  health: 20
};

let grounded = false;

/* =========================================================
   BLOCKS
========================================================= */

const BLOCKS = {
  air: {
    name: "Luft",
    color: "#000000",
    solid: false,
    transparent: true
  },

  grass: {
    name: "Gras",
    color: "#58ae46",
    solid: true,
    transparent: false
  },

  dirt: {
    name: "Erde",
    color: "#86512d",
    solid: true,
    transparent: false
  },

  stone: {
    name: "Stein",
    color: "#7a8085",
    solid: true,
    transparent: false
  },

  sand: {
    name: "Sand",
    color: "#dac37b",
    solid: true,
    transparent: false
  },

  sandstone: {
    name: "Sandstein",
    color: "#d2c48f",
    solid: true,
    transparent: false
  },

  gravel: {
    name: "Kies",
    color: "#9a958f",
    solid: true,
    transparent: false
  },

  woodOak: {
    name: "Eichenholz",
    color: "#8b5a2b",
    solid: true,
    transparent: false
  },

  woodBirch: {
    name: "Birkenholz",
    color: "#bfa886",
    solid: true,
    transparent: false
  },

  woodSpruce: {
    name: "Fichtenholz",
    color: "#6f4626",
    solid: true,
    transparent: false
  },

  leavesOak: {
    name: "Eichenlaub",
    color: "#3a8849",
    solid: true,
    transparent: true
  },

  leavesBirch: {
    name: "Birkenlaub",
    color: "#4fa35e",
    solid: true,
    transparent: true
  },

  leavesSpruce: {
    name: "Fichtenlaub",
    color: "#2f723d",
    solid: true,
    transparent: true
  },

  brick: {
    name: "Ziegel",
    color: "#aa4f3c",
    solid: true,
    transparent: false
  },

  glass: {
    name: "Glas",
    color: "#74d6e6",
    solid: true,
    transparent: true
  },

  glow: {
    name: "Leuchtblock",
    color: "#f4c84c",
    solid: true,
    transparent: false
  },

  water: {
    name: "Wasser",
    color: "#318dcc",
    solid: false,
    transparent: true
  },

  lava: {
    name: "Lava",
    color: "#d95b2a",
    solid: false,
    transparent: true
  },

  ice: {
    name: "Eis",
    color: "#a6d9e8",
    solid: true,
    transparent: true
  },

  sponge: {
    name: "Schwamm",
    color: "#f4e96a",
    solid: true,
    transparent: false
  },

  obsidian: {
    name: "Obsidian",
    color: "#2a1f35",
    solid: true,
    transparent: false
  }
};

const HOTBAR = [
  "grass",
  "dirt",
  "stone",
  "sand",
  "sandstone",
  "gravel",
  "woodOak",
  "woodBirch",
  "woodSpruce",
  "leavesOak",
  "leavesBirch",
  "leavesSpruce",
  "brick",
  "glass",
  "glow",
  "water",
  "lava",
  "ice",
  "sponge",
  "obsidian"
];

/* =========================================================
   BLOCK-DATEN
========================================================= */

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function airBlock() {
  return {
    id: "air",
    solid: false,
    transparent: true
  };
}

function waterBlock(level = 8) {
  return {
    id: "water",
    level,
    solid: false,
    transparent: true
  };
}

function lavaBlock(level = 8) {
  return {
    id: "lava",
    level,
    solid: false,
    transparent: true
  };
}

function getBlock(x, y, z) {
  return world.get(
    blockKey(x, y, z)
  ) || airBlock();
}

function getBlockId(x, y, z) {
  return getBlock(x, y, z).id;
}

function setBlock(x, y, z, block) {
  const id = blockKey(x, y, z);

  if (
    !block ||
    block.id === "air"
  ) {
    world.delete(id);
  } else {
    world.set(id, block);
  }
}

function isSolid(x, y, z) {
  const block = getBlock(x, y, z);

  return (
    block.id !== "air" &&
    block.id !== "water" &&
    block.id !== "lava" &&
    block.solid === true
  );
}

/* =========================================================
   ZUFALL UND TERRAIN
========================================================= */

function random2D(x, z, extra = 0) {
  const value = Math.sin(
    x * 127.1 +
    z * 311.7 +
    extra * 19.2 +
    seed * 0.017
  ) * 43758.5453;

  return value - Math.floor(value);
}

function smoothNoise(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const sx = x - x0;
  const sz = z - z0;

  const a = random2D(x0, z0);
  const b = random2D(x1, z0);
  const c = random2D(x0, z1);
  const d = random2D(x1, z1);

  const first = a * (1 - sx) + b * sx;
  const second = c * (1 - sx) + d * sx;

  return first * (1 - sz) + second * sz;
}

function terrainHeight(x, z) {
  const large = smoothNoise(
    x * 0.04,
    z * 0.04
  );

  const medium = smoothNoise(
    x * 0.1,
    z * 0.1
  );

  const small = smoothNoise(
    x * 0.23,
    z * 0.23
  );

  return Math.max(
    2,
    Math.min(
      WORLD_HEIGHT - 4,
      Math.floor(
        3 +
        large * 11 +
        medium * 4 +
        small * 2
      )
    )
  );
}

/* =========================================================
   CHUNKS
========================================================= */

function chunkCoordinate(value) {
  return Math.floor(
    value / CHUNK_SIZE
  );
}

function chunkId(cx, cz) {
  return `${cx},${cz}`;
}

function createTree(x, y, z, type = "oak") {
  const height =
    3 + Math.floor(
      random2D(x, z, 4) * 3
    );

  const woodId =
    type === "birch"
      ? "woodBirch"
      : type === "spruce"
        ? "woodSpruce"
        : "woodOak";

  const leafId =
    type === "birch"
      ? "leavesBirch"
      : type === "spruce"
        ? "leavesSpruce"
        : "leavesOak";

  for (
    let i = 0;
    i < height;
    i++
  ) {
    setBlock(
      x,
      y + i,
      z,
      {
        id: woodId,
        solid: true,
        transparent: false
      }
    );
  }

  const top = y + height;

  for (
    let dx = -2;
    dx <= 2;
    dx++
  ) {
    for (
      let dz = -2;
      dz <= 2;
      dz++
    ) {
      for (
        let dy = -1;
        dy <= 1;
        dy++
      ) {
        if (
          Math.abs(dx) +
          Math.abs(dz) <= 3 &&
          getBlockId(
            x + dx,
            top + dy,
            z + dz
          ) === "air"
        ) {
          setBlock(
            x + dx,
            top + dy,
            z + dz,
            {
              id: leafId,
              solid: true,
              transparent: true
            }
          );
        }
      }
    }
  }
}

function generateChunk(cx, cz) {
  const id = chunkId(cx, cz);

  if (chunks.has(id)) {
    return;
  }

  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;

  for (
    let localX = 0;
    localX < CHUNK_SIZE;
    localX++
  ) {
    for (
      let localZ = 0;
      localZ < CHUNK_SIZE;
      localZ++
    ) {
      const x = startX + localX;
      const z = startZ + localZ;
      const height = terrainHeight(x, z);

      for (
        let y = 0;
        y <= height;
        y++
      ) {
        let blockId = "stone";

        if (
          y === height
        ) {
          blockId =
            height <= SEA_LEVEL + 1
              ? "sand"
              : "grass";
        } else if (
          y >= height - 2
        ) {
          blockId =
            height <= SEA_LEVEL + 1
              ? "sand"
              : "dirt";
        } else if (
          y === height - 3
        ) {
          if (
            random2D(x, z, 3) > 0.7
          ) {
            blockId = "gravel";
          } else if (
            random2D(x, z, 5) > 0.85
          ) {
            blockId = "sandstone";
          }
        }

        setBlock(
          x,
          y,
          z,
          {
            id: blockId,
            solid: true,
            transparent: false
          }
        );
      }

      if (
        height < SEA_LEVEL
      ) {
        for (
          let y = height + 1;
          y <= SEA_LEVEL;
          y++
        ) {
          setBlock(
            x,
            y,
            z,
            waterBlock()
          );
        }
      }

      if (
        height > SEA_LEVEL + 1 &&
        random2D(x, z, 9) > 0.91
      ) {
        const type =
          random2D(x, z, 10) > 0.7
            ? "birch"
            : random2D(x, z, 11) > 0.85
              ? "spruce"
              : "oak";

        createTree(
          x,
          height + 1,
          z,
          type
        );
      }

      if (
        height > SEA_LEVEL + 4 &&
        random2D(x, z, 12) > 0.97
      ) {
        setBlock(
          x,
          4,
          z,
          lavaBlock()
        );
      }
    }
  }

  chunks.set(
    id,
    {
      cx,
      cz
    }
  );
}

function unloadFarChunks(centerX, centerZ) {
  for (
    const [id, chunk]
    of chunks.entries()
  ) {
    const distance = Math.max(
      Math.abs(chunk.cx - centerX),
      Math.abs(chunk.cz - centerZ)
    );

    if (
      distance > VIEW_DISTANCE + 1
    ) {
      const startX =
        chunk.cx * CHUNK_SIZE;

      const startZ =
        chunk.cz * CHUNK_SIZE;

      for (
        let x = startX;
        x < startX + CHUNK_SIZE;
        x++
      ) {
        for (
          let z = startZ;
          z < startZ + CHUNK_SIZE;
          z++
        ) {
          for (
            let y = 0;
            y < WORLD_HEIGHT;
            y++
          ) {
            world.delete(
              blockKey(x, y, z)
            );
          }
        }
      }

      chunks.delete(id);
    }
  }
}

function updateChunks() {
  const centerX =
    chunkCoordinate(
      player.position.x
    );

  const centerZ =
    chunkCoordinate(
      player.position.z
    );

  for (
    let cx = centerX - VIEW_DISTANCE;
    cx <= centerX + VIEW_DISTANCE;
    cx++
  ) {
    for (
      let cz = centerZ - VIEW_DISTANCE;
      cz <= centerZ + VIEW_DISTANCE;
      cz++
    ) {
      generateChunk(cx, cz);
    }
  }

  unloadFarChunks(
    centerX,
    centerZ
  );

  worldDirty = true;
}

/* =========================================================
   TEXTUREN
========================================================= */

function parseHex(hex) {
  const value = hex.replace("#", "");

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function colorString(color, amount = 0) {
  return `rgb(${
    Math.max(
      0,
      Math.min(
        255,
        color.r + amount
      )
    )
  }, ${
    Math.max(
      0,
      Math.min(
        255,
        color.g + amount
      )
    )
  }, ${
    Math.max(
      0,
      Math.min(
        255,
        color.b + amount
      )
    )
  })`;
}

function createTexture(blockId) {
  if (
    textureCache.has(blockId)
  ) {
    return textureCache.get(
      blockId
    );
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 16;
  canvas.height = 16;

  const context =
    canvas.getContext(
      "2d"
    );

  const base =
    parseHex(
      BLOCKS[blockId].color
    );

  context.fillStyle =
    colorString(base);

  context.fillRect(
    0,
    0,
    16,
    16
  );

  for (
    let y = 0;
    y < 16;
    y++
  ) {
    for (
      let x = 0;
      x < 16;
      x++
    ) {
      const random =
        random2D(
          x,
          y,
          blockId.length
        );

      const shade =
        random < 0.16
          ? -26
          : random > 0.85
            ? 24
            : random > 0.68
              ? 9
              : 0;

      context.fillStyle =
        colorString(
          base,
          shade
        );

      context.fillRect(
        x,
        y,
        1,
        1
      );
    }
  }

  if (
    blockId === "grass"
  ) {
    context.fillStyle =
      "#2c8737";

    for (
      let i = 0;
      i < 30;
      i++
    ) {
      context.fillRect(
        Math.floor(
          random2D(i, 2, 5) * 16
        ),
        Math.floor(
          random2D(i, 4, 6) * 5
        ),
        1,
        1
      );
    }
  }

  if (
    blockId === "stone"
  ) {
    context.fillStyle =
      "#565d62";

    for (
      let i = 0;
      i < 14;
      i++
    ) {
      context.fillRect(
        Math.floor(
          random2D(i, 3, 7) * 16
        ),
        Math.floor(
          random2D(i, 4, 8) * 16
        ),
        2,
        1
      );
    }
  }

  if (
    blockId === "woodOak" ||
    blockId === "woodBirch" ||
    blockId === "woodSpruce"
  ) {
    context.fillStyle =
      blockId === "woodOak"
        ? "#4b2f18"
        : blockId === "woodBirch"
          ? "#6d5438"
          : "#3d2614";

    for (
      let y = 2;
      y < 16;
      y += 4
    ) {
      context.fillRect(
        0,
        y,
        16,
        1
      );
    }
  }

  if (
    blockId === "leavesOak" ||
    blockId === "leavesBirch" ||
    blockId === "leavesSpruce"
  ) {
    context.fillStyle =
      blockId === "leavesOak"
        ? "#266a3a"
        : blockId === "leavesBirch"
          ? "#327a43"
          : "#1f5a30";

    for (
      let i = 0;
      i < 25;
      i++
    ) {
      context.fillRect(
        Math.floor(
          random2D(i, 5, 9) * 16
        ),
        Math.floor(
          random2D(i, 6, 10) * 16
        ),
        1,
        1
      );
    }
  }

  if (
    blockId === "brick"
  ) {
    context.fillStyle =
      "#58251f";

    for (
      let y = 5;
      y < 16;
      y += 6
    ) {
      context.fillRect(
        0,
        y,
        16,
        1
      );
    }

    for (
      let x = 4;
      x < 16;
      x += 8
    ) {
      context.fillRect(
        x,
        0,
        1,
        16
      );
    }
  }

  if (
    blockId === "lava"
  ) {
    context.fillStyle =
      "#ff964a";

    for (
      let i = 0;
      i < 20;
      i++
    ) {
      context.fillRect(
        Math.floor(
          random2D(i, 7, 11) * 16
        ),
        Math.floor(
          random2D(i, 8, 12) * 16
        ),
        1,
        1
      );
    }
  }

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.magFilter =
    THREE.NearestFilter;

  texture.minFilter =
    THREE.NearestFilter;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  textureCache.set(
    blockId,
    texture
  );

  return texture;
}

/* =========================================================
   CHUNK-MESHES
========================================================= */

const faces = [
  {
    normal: [0, 1, 0],
    corners: [
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [0, 1, 1]
    ]
  },
  {
    normal: [0, -1, 0],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
      [0, 0, 0]
    ]
  },
  {
    normal: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0]
    ]
  },
  {
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1]
    ]
  },
  {
    normal: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1]
    ]
  },
  {
    normal: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0]
    ]
  }
];

function faceVisible(x, y, z, normal) {
  const next =
    getBlock(
      x + normal[0],
      y + normal[1],
      z + normal[2]
    );

  return (
    next.id === "air" ||
    next.id === "water" ||
    next.id === "lava" ||
    next.transparent
  );
}

function buildChunk(chunk) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const startX =
    chunk.cx * CHUNK_SIZE;

  const startZ =
    chunk.cz * CHUNK_SIZE;

  for (
    let x = startX;
    x < startX + CHUNK_SIZE;
    x++
  ) {
    for (
      let z = startZ;
      z < startZ + CHUNK_SIZE;
      z++
    ) {
      for (
        let y = 0;
        y < WORLD_HEIGHT;
        y++
      ) {
        const block =
          getBlock(x, y, z);

        if (
          block.id === "air"
        ) {
          continue;
        }

        for (
          const face of faces
        ) {
          if (
            !faceVisible(
              x,
              y,
              z,
              face.normal
            )
          ) {
            continue;
          }

          const start =
            positions.length / 3;

          for (
            const corner of face.corners
          ) {
            positions.push(
              x + corner[0],
              y + corner[1],
              z + corner[2]
            );

            normals.push(
              face.normal[0],
              face.normal[1],
              face.normal[2]
            );
          }

          uvs.push(
            0, 0,
            1, 0,
            1, 1,
            0, 1
          );

          indices.push(
            start,
            start + 1,
            start + 2,
            start,
            start + 2,
            start + 3
          );
        }
      }
    }
  }

  if (
    positions.length === 0
  ) {
    return null;
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      normals,
      3
    )
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      uvs,
      2
    )
  );

  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material =
    new THREE.MeshStandardMaterial({
      map: createTexture("grass"),
      color: 0xffffff,
      roughness: 0.9,
      side: THREE.DoubleSide
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  mesh.frustumCulled = true;

  return mesh;
}

function rebuildChunk(cx, cz) {
  const id =
    chunkId(cx, cz);

  const old =
    chunkMeshes.get(id);

  if (
    old
  ) {
    worldGroup.remove(old);
    old.geometry.dispose();
    old.material.dispose();
    chunkMeshes.delete(id);
  }

  const chunk =
    chunks.get(id);

  if (
    !chunk
  ) {
    return;
  }

  const mesh =
    buildChunk(chunk);

  if (
    mesh
  ) {
    worldGroup.add(mesh);
    chunkMeshes.set(id, mesh);
  }
}

function rebuildAllChunks() {
  for (
    const mesh of chunkMeshes.values()
  ) {
    worldGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  chunkMeshes.clear();

  for (
    const chunk of chunks.values()
  ) {
    rebuildChunk(
      chunk.cx,
      chunk.cz
    );
  }
}

/* =========================================================
   THREE.JS
========================================================= */

function initThree() {
  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(0x82c7e9);

  scene.fog =
    new THREE.Fog(
      0x82c7e9,
      15,
      VIEW_DISTANCE * CHUNK_SIZE * 1.4
    );

  camera =
    new THREE.PerspectiveCamera(
      75,
      window.innerWidth /
      window.innerHeight,
      0.05,
      150
    );

  renderer =
    new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance"
    });

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.2
    )
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight,
    false
  );

  renderer.outputColorSpace =
    THREE.SRGBColorSpace;

  document.body.appendChild(
    renderer.domElement
  );

  clock =
    new THREE.Clock();

  scene.add(
    new THREE.HemisphereLight(
      0xc8efff,
      0x493429,
      1.25
    )
  );

  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      1.35
    );

  sun.position.set(
    30,
    45,
    20
  );

  scene.add(sun);

  worldGroup =
    new THREE.Group();

  scene.add(worldGroup);

  window.addEventListener(
    "resize",
    resize
  );

  renderer.domElement.addEventListener(
    "contextmenu",
    event => event.preventDefault()
  );

  renderer.domElement.addEventListener(
    "mousedown",
    handleMouseDown
  );

  document.addEventListener(
    "mousemove",
    handleMouseMove
  );

  document.addEventListener(
    "pointerlockchange",
    () => {
      pointerLocked =
        document.pointerLockElement ===
        renderer.domElement;
    }
  );
}

function resize() {
  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      1.2
    )
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight,
    false
  );
}

/* =========================================================
   SPIELERPHYSIK
========================================================= */

function playerCollides(position) {
  const minX =
    Math.floor(
      position.x - PLAYER_RADIUS
    );

  const maxX =
    Math.floor(
      position.x + PLAYER_RADIUS
    );

  const minY =
    Math.floor(position.y);

  const maxY =
    Math.floor(
      position.y + PLAYER_HEIGHT
    );

  const minZ =
    Math.floor(
      position.z - PLAYER_RADIUS
    );

  const maxZ =
    Math.floor(
      position.z + PLAYER_RADIUS
    );

  for (
    let x = minX;
    x <= maxX;
    x++
  ) {
    for (
      let y = minY;
      y <= maxY;
      y++
    ) {
      for (
        let z = minZ;
        z <= maxZ;
        z++
      ) {
        if (
          isSolid(x, y, z)
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function pressed(code) {
  return Boolean(
    keys[code] ||
    touchKeys[code]
  );
}

function updatePlayer(delta) {
  if (
    !gameActive ||
    gamePaused ||
    inventoryOpen
  ) {
    return;
  }

  move.set(0, 0, 0);

  if (
    pressed("KeyW")
  ) {
    move.z -= 1;
  }

  if (
    pressed("KeyS")
  ) {
    move.z += 1;
  }

  if (
    pressed("KeyA")
  ) {
    move.x -= 1;
  }

  if (
    pressed("KeyD")
  ) {
    move.x += 1;
  }

  if (
    move.lengthSq() > 0
  ) {
    move.normalize();

    const forward =
      new THREE.Vector3(
        Math.sin(yaw),
        0,
        Math.cos(yaw)
      );

    side.set(
      Math.cos(yaw),
      0,
      -Math.sin(yaw)
    );

    const dx =
      side.x * move.x +
      forward.x * move.z;

    const dz =
      side.z * move.x +
      forward.z * move.z;

    const speed =
      pressed("ShiftLeft") ||
      pressed("ShiftRight")
        ? player.sprint
        : player.speed;

    velocity.x =
      dx * speed;

    velocity.z =
      dz * speed;
  } else {
    velocity.x *=
      Math.pow(0.001, delta);

    velocity.z *=
      Math.pow(0.001, delta);
  }

  velocity.y -=
    22 * delta;

  if (
    pressed("Space") ||
    pressed("jump")
  ) {
    if (
      grounded
    ) {
      velocity.y =
        player.jump;

      grounded = false;
    }

    touchKeys.jump = false;
  }

  const old =
    player.position.clone();

  player.position.x +=
    velocity.x * delta;

  if (
    playerCollides(
      player.position
    )
  ) {
    player.position.x =
      old.x;

    velocity.x = 0;
  }

  player.position.z +=
    velocity.z * delta;

  if (
    playerCollides(
      player.position
    )
  ) {
    player.position.z =
      old.z;

    velocity.z = 0;
  }

  player.position.y +=
    velocity.y * delta;

  if (
    playerCollides(
      player.position
    )
  ) {
    if (
      velocity.y < 0
    ) {
      grounded = true;
    }

    player.position.y =
      old.y;

    velocity.y = 0;
  } else {
    grounded = false;
  }

  if (
    player.position.y < -10
  ) {
    player.position.set(
      0,
      18,
      0
    );

    velocity.set(
      0,
      0,
      0
    );
  }

  updateCamera();
}

function updateCamera() {
  camera.position.set(
    player.position.x,
    player.position.y +
      PLAYER_HEIGHT -
      0.15,
    player.position.z
  );

  camera.rotation.order =
    "YXZ";

  camera.rotation.y =
    yaw;

  camera.rotation.x =
    pitch;
}

/* =========================================================
   KAMERA
========================================================= */

function handleMouseDown(event) {
  if (
    !gameActive ||
    gamePaused ||
    inventoryOpen
  ) {
    return;
  }

  if (
    renderer.domElement.requestPointerLock
  ) {
    renderer.domElement.requestPointerLock();
  }

  if (
    event.button === 0
  ) {
    breakBlock();
  }

  if (
    event.button === 2
  ) {
    placeBlock();
  }
}

function handleMouseMove(event) {
  if (
    !pointerLocked ||
    !gameActive ||
    gamePaused ||
    inventoryOpen
  ) {
    return;
  }

  yaw -=
    event.movementX * 0.0022;

  pitch -=
    event.movementY * 0.0022;

  limitPitch();
  updateCamera();
}

function limitPitch() {
  const limit =
    Math.PI / 2 - 0.04;

  pitch =
    Math.max(
      -limit,
      Math.min(
        limit,
        pitch
      )
    );
}

let cameraTouchId = null;
let lastTouchX = 0;
let lastTouchY = 0;
let touchStartedOnUI = false;

function isUI(target) {
  return Boolean(
    target.closest("#touch") ||
    target.closest("#hotbar") ||
    target.closest("#menu") ||
    target.closest("#pause") ||
    target.closest("#inventory")
  );
}

document.addEventListener(
  "touchstart",
  event => {
    if (
      !gameActive ||
      gamePaused ||
      inventoryOpen
    ) {
      return;
    }

    const touch =
      event.changedTouches[0];

    touchStartedOnUI =
      isUI(event.target);

    if (
      touchStartedOnUI
    ) {
      return;
    }

    cameraTouchId =
      touch.identifier;

    lastTouchX =
      touch.clientX;

    lastTouchY =
      touch.clientY;

    event.preventDefault();
  },
  {
    passive: false
  }
);

document.addEventListener(
  "touchmove",
  event => {
    if (
      cameraTouchId === null ||
      touchStartedOnUI
    ) {
      return;
    }

    let touch = null;

    for (
      const current
      of event.changedTouches
    ) {
      if (
        current.identifier ===
        cameraTouchId
      ) {
        touch = current;
        break;
      }
    }

    if (
      !touch
    ) {
      return;
    }

    const dx =
      touch.clientX -
      lastTouchX;

    const dy =
      touch.clientY -
      lastTouchY;

    lastTouchX =
      touch.clientX;

    lastTouchY =
      touch.clientY;

    yaw -=
      dx * 0.008;

    pitch -=
      dy * 0.008;

    limitPitch();
    updateCamera();

    event.preventDefault();
  },
  {
    passive: false
  }
);

document.addEventListener(
  "touchend",
  event => {
    for (
      const touch
      of event.changedTouches
    ) {
      if (
        touch.identifier ===
        cameraTouchId
      ) {
        cameraTouchId = null;
        touchStartedOnUI = false;
      }
    }

    event.preventDefault();
  },
  {
    passive: false
  }
);

document.addEventListener(
  "touchcancel",
  () => {
    cameraTouchId = null;
    touchStartedOnUI = false;
  },
  {
    passive: false
  }
);

/* =========================================================
   BLOCK-AKTIONEN
========================================================= */

function getTargetBlock() {
  const raycaster =
    new THREE.Raycaster();

  raycaster.setFromCamera(
    new THREE.Vector2(0, 0),
    camera
  );

  raycaster.far =
    REACH;

  const hits =
    raycaster.intersectObject(
      worldGroup,
      true
    );

  if (
    hits.length === 0
  ) {
    return null;
  }

  return hits[0];
}

function rebuildAround(x, z) {
  rebuildChunk(
    chunkCoordinate(x),
    chunkCoordinate(z)
  );

  if (
    x % CHUNK_SIZE === 0
  ) {
    rebuildChunk(
      chunkCoordinate(x) - 1,
      chunkCoordinate(z)
    );
  }

  if (
    z % CHUNK_SIZE === 0
  ) {
    rebuildChunk(
      chunkCoordinate(x),
      chunkCoordinate(z) - 1
    );
  }
}

function breakBlock() {
  const hit =
    getTargetBlock();

  if (
    !hit
  ) {
    return;
  }

  const point =
    hit.point.clone().addScaledVector(
      hit.face.normal,
      -0.01
    );

  const x =
    Math.floor(point.x);

  const y =
    Math.floor(point.y);

  const z =
    Math.floor(point.z);

  if (
    y <= 0
  ) {
    return;
  }

  setBlock(
    x,
    y,
    z,
    airBlock()
  );

  rebuildAround(x, z);
}

function placeBlock() {
  const hit =
    getTargetBlock();

  if (
    !hit
  ) {
    return;
  }

  const point =
    hit.point.clone().addScaledVector(
      hit.face.normal,
      0.01
    );

  const x =
    Math.floor(point.x);

  const y =
    Math.floor(point.y);

  const z =
    Math.floor(point.z);

  const blockId =
    HOTBAR[selected];

  if (
    getBlockId(x, y, z) !== "air"
  ) {
    return;
  }

  setBlock(
    x,
    y,
    z,
    {
      id: blockId,
      solid: BLOCKS[blockId].solid,
      transparent:
        BLOCKS[blockId].transparent
    }
  );

  if (
    playerCollides(
      player.position
    )
  ) {
    setBlock(
      x,
      y,
      z,
      airBlock()
    );

    return;
  }

  rebuildAround(x, z);
}

/* =========================================================
   WASSER UND LAVA
========================================================= */

function updateFluid(type) {
  const changes = [];
  let processed = 0;

  for (
    const [id, block]
    of world.entries()
  ) {
    if (
      block.id !== type
    ) {
      continue;
    }

    processed++;

    if (
      processed > 80
    ) {
      break;
    }

    const [
      x,
      y,
      z
    ] = id.split(",").map(Number);

    const below =
      getBlock(
        x,
        y - 1,
        z
      );

    if (
      below.id === "air"
    ) {
      changes.push({
        x,
        y,
        z,
        block: airBlock()
      });

      changes.push({
        x,
        y: y - 1,
        z,
        block:
          type === "water"
            ? waterBlock()
            : lavaBlock()
      });

      continue;
    }

    const level =
      block.level || 1;

    if (
      level <= 1
    ) {
      continue;
    }

    const nextLevel =
      level - 1;

    const directions = [
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y, z + 1],
      [x, y, z - 1]
    ];

    for (
      const [
        nx,
        ny,
        nz
      ] of directions
    ) {
      const target =
        getBlock(
          nx,
          ny,
          nz
        );

      if (
        target.id === "air"
      ) {
        changes.push({
          x: nx,
          y: ny,
          z: nz,
          block:
            type === "water"
              ? waterBlock(nextLevel)
              : lavaBlock(nextLevel)
        });
      }
    }
  }

  for (
    const change
    of changes
  ) {
    setBlock(
      change.x,
      change.y,
      change.z,
      change.block
    );

    rebuildAround(
      change.x,
      change.z
    );
  }
}

/* =========================================================
   UI
========================================================= */

function makePreview(id) {
  const element =
    document.createElement("div");

  element.className =
    "preview";

  element.style.background =
    BLOCKS[id].color;

  return element;
}

function updateHotbar() {
  const bar =
    document.getElementById(
      "hotbar"
    );

  bar.innerHTML = "";

  HOTBAR.forEach(
    (id, index) => {
      const slot =
        document.createElement("div");

      slot.className =
        "slot";

      if (
        index === selected
      ) {
        slot.classList.add(
          "selected"
        );
      }

      const number =
        document.createElement(
          "span"
        );

      number.className =
        "slot-number";

      number.textContent =
        index + 1;

      const count =
        document.createElement(
          "span"
        );

      count.className =
        "slot-count";

      count.textContent =
        "∞";

      slot.appendChild(number);
      slot.appendChild(
        makePreview(id)
      );
      slot.appendChild(count);

      slot.addEventListener(
        "click",
        () => {
          selected = index;
          updateHotbar();
          showSelected();
        }
      );

      bar.appendChild(slot);
    }
  );
}

function showSelected() {
  const label =
    document.getElementById(
      "selectedName"
    );

  label.textContent =
    BLOCKS[
      HOTBAR[selected]
    ].name;

  label.style.opacity =
    "1";

  clearTimeout(
    showSelected.timer
  );

  showSelected.timer =
    setTimeout(
      () => {
        label.style.opacity =
          "0";
      },
      1200
    );
}

function createInventory() {
  const grid =
    document.getElementById(
      "inventoryGrid"
    );

  grid.innerHTML = "";

  Object.keys(BLOCKS)
    .filter(
      id => id !== "air"
    )
    .forEach(
      id => {
        const item =
          document.createElement(
            "button"
          );

        item.className =
          "inventory-item";

        item.appendChild(
          makePreview(id)
        );

        item.appendChild(
          document.createTextNode(
            BLOCKS[id].name
          )
        );

        item.addEventListener(
          "click",
          () => {
            const index =
              HOTBAR.indexOf(id);

            if (
              index >= 0
            ) {
              selected = index;
              updateHotbar();
            }

            closeInventory();
          }
        );

        grid.appendChild(item);
      }
    );
}

function toggleInventory() {
  if (
    !gameActive
  ) {
    return;
  }

  inventoryOpen =
    !inventoryOpen;

  document.getElementById(
    "inventory"
  ).style.display =
    inventoryOpen
      ? "flex"
      : "none";
}

function closeInventory() {
  inventoryOpen =
    false;

  document.getElementById(
    "inventory"
  ).style.display =
    "none";
}

/* =========================================================
   TOUCH-BUTTONS
========================================================= */

function bindButton(id, action) {
  const element =
    document.getElementById(id);

  element.addEventListener(
    "touchstart",
    event => {
      event.preventDefault();
      event.stopPropagation();
      touchKeys[action] = true;
    },
    {
      passive: false
    }
  );

  element.addEventListener(
    "touchend",
    event => {
      event.preventDefault();
      event.stopPropagation();
      touchKeys[action] = false;
    },
    {
      passive: false
    }
  );

  element.addEventListener(
    "touchcancel",
    event => {
      event.preventDefault();
      event.stopPropagation();
      touchKeys[action] = false;
    },
    {
      passive: false
    }
  );
}

bindButton("forward", "KeyW");
bindButton("left", "KeyA");
bindButton("back", "KeyS");
bindButton("right", "KeyD");
bindButton("jump", "jump");

document.getElementById(
  "break"
).addEventListener(
  "touchstart",
  event => {
    event.preventDefault();
    event.stopPropagation();
    breakBlock();
  },
  {
    passive: false
  }
);

document.getElementById(
  "place"
).addEventListener(
  "touchstart",
  event => {
    event.preventDefault();
    event.stopPropagation();
    placeBlock();
  },
  {
    passive: false
  }
);

document.getElementById(
  "invButton"
).addEventListener(
  "touchstart",
  event => {
    event.preventDefault();
    event.stopPropagation();
    toggleInventory();
  },
  {
    passive: false
  }
);

/* =========================================================
   TASTATUR
========================================================= */

document.addEventListener(
  "keydown",
  event => {
    keys[event.code] = true;

    if (
      event.code === "Space" ||
      event.code.startsWith("Arrow")
    ) {
      event.preventDefault();
    }

    if (
      event.code === "KeyE"
    ) {
      toggleInventory();
    }

    if (
      event.code === "Escape"
    ) {
      if (
        inventoryOpen
      ) {
        closeInventory();
      } else {
        togglePause();
      }
    }

    if (
      event.code === "KeyF"
    ) {
      saveGame();
    }

    if (
      event.code.startsWith("Digit")
    ) {
      const number =
        Number(
          event.code.replace(
            "Digit",
            ""
          )
        );

      if (
        number >= 1 &&
        number <= HOTBAR.length
      ) {
        selected =
          number - 1;

        updateHotbar();
        showSelected();
      }
    }
  }
);

document.addEventListener(
  "keyup",
  event => {
    keys[event.code] = false;
  }
);

/* =========================================================
   PAUSE UND SPEICHERN
========================================================= */

function togglePause() {
  if (
    !gameActive ||
    inventoryOpen
  ) {
    return;
  }

  gamePaused =
    !gamePaused;

  document.getElementById(
    "pause"
  ).style.display =
    gamePaused
      ? "flex"
      : "none";
}

function saveGame() {
  const data = {
    seed,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    },
    blocks: Array.from(
      world.entries()
    ),
    chunks: Array.from(
      chunks.entries()
    )
  };

  localStorage.setItem(
    "blockworld-save",
    JSON.stringify(data)
  );

  alert(
    "Welt gespeichert."
  );
}

function loadGame() {
  const saved =
    localStorage.getItem(
      "blockworld-save"
    );

  if (
    !saved
  ) {
    alert(
      "Keine Welt gespeichert."
    );

    return;
  }

  const data =
    JSON.parse(saved);

  seed =
    data.seed;

  player.position.set(
    data.player.x,
    data.player.y,
    data.player.z
  );

  world =
    new Map(
      data.blocks
    );

  chunks =
    new Map(
      data.chunks
    );

  rebuildAllChunks();
  startGame();
}

function newGame() {
  seed =
    Math.floor(
      Math.random() *
      999999999
    );

  world.clear();
  chunks.clear();

  player.position.set(
    0,
    18,
    0
  );

  velocity.set(
    0,
    0,
    0
  );

  updateChunks();
  rebuildAllChunks();
  startGame();
}

function startGame() {
  gameActive =
    true;

  gamePaused =
    false;

  document.getElementById(
    "menu"
  ).style.display =
    "none";

  document.getElementById(
    "pause"
  ).style.display =
    "none";

  updateCamera();
  updateHotbar();
  showSelected();
}

function returnToMenu() {
  gameActive =
    false;

  gamePaused =
    false;

  document.getElementById(
    "pause"
  ).style.display =
    "none";

  document.getElementById(
    "menu"
  ).style.display =
    "flex";
}

/* =========================================================
   LOOP
========================================================= */

function updateHUD(delta) {
  document.getElementById(
    "hp"
  ).textContent =
    player.health;

  document.getElementById(
    "xyz"
  ).textContent =
    `${Math.floor(player.position.x)} / ${
      Math.floor(player.position.y)
    } / ${
      Math.floor(player.position.z)
    }`;

  frameCounter++;
  frameTimer += delta;

  if (
    frameTimer >= 0.5
  ) {
    fps =
      Math.round(
        frameCounter /
        frameTimer
      );

    frameCounter = 0;
    frameTimer = 0;
  }

  document.getElementById(
    "fps"
  ).textContent =
    fps;
}

function gameLoop() {
  requestAnimationFrame(
    gameLoop
  );

  const delta =
    Math.min(
      clock.getDelta(),
      0.05
    );

  updatePlayer(delta);
  updateHUD(delta);

  chunkTimer += delta;

  if (
    chunkTimer >= CHUNK_INTERVAL
  ) {
    chunkTimer = 0;

    updateChunks();

    if (
      worldDirty
    ) {
      worldDirty = false;
      rebuildAllChunks();
    }
  }

  waterTimer += delta;

  if (
    waterTimer >= WATER_INTERVAL
  ) {
    waterTimer = 0;
    updateFluid("water");
  }

  lavaTimer += delta;

  if (
    lavaTimer >= LAVA_INTERVAL
  ) {
    lavaTimer = 0;
    updateFluid("lava");
  }

  renderer.render(
    scene,
    camera
  );
}

/* =========================================================
   START
========================================================= */

document.getElementById(
  "newGame"
).addEventListener(
  "click",
  newGame
);

document.getElementById(
  "loadGame"
).addEventListener(
  "click",
  loadGame
);

document.getElementById(
  "resume"
).addEventListener(
  "click",
  togglePause
);

document.getElementById(
  "save"
).addEventListener(
  "click",
  saveGame
);

document.getElementById(
  "goMenu"
).addEventListener(
  "click",
  returnToMenu
);

document.getElementById(
  "closeInventory"
).addEventListener(
  "click",
  closeInventory
);

initThree();
createInventory();
updateHotbar();
updateChunks();
rebuildAllChunks();
updateCamera();
gameLoop();