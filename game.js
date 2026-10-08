"use strict";

/* =========================================================
   BLOCKWORLD
========================================================= */

const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 28;
const VIEW_DISTANCE = 1;
const SEA_LEVEL = 6;

const PLAYER_HEIGHT = 1.75;
const PLAYER_RADIUS = 0.3;
const REACH = 6;

const WATER_INTERVAL = 1.8;
const LAVA_INTERVAL = 2.8;

let scene;
let camera;
let renderer;
let clock;
let worldGroup;

let seed = Math.floor(
    Math.random() * 999999999
);

let world = new Map();
let chunks = new Map();
let chunkMeshes = new Map();
let textureCache = new Map();

let gameActive = false;
let paused = false;
let inventoryOpen = false;
let pointerLocked = false;

let selectedSlot = 0;
let yaw = 0;
let pitch = 0;

let waterTimer = 0;
let lavaTimer = 0;
let fpsTimer = 0;
let fpsFrames = 0;
let fps = 0;

const keys = {};
const touchKeys = {};

const velocity = new THREE.Vector3();
const moveVector = new THREE.Vector3();
const sideVector = new THREE.Vector3();

const player = {
    position: new THREE.Vector3(0, 18, 0),
    speed: 5,
    sprint: 7,
    jump: 8,
    health: 20
};

let grounded = false;

/* =========================================================
   BLOCKTYPEN
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
        color: "#5aae46",
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
        color: "#777d82",
        solid: true,
        transparent: false
    },

    sand: {
        name: "Sand",
        color: "#d9c27a",
        solid: true,
        transparent: false
    },

    sandstone: {
        name: "Sandstein",
        color: "#d0bd82",
        solid: true,
        transparent: false
    },

    gravel: {
        name: "Kies",
        color: "#99958e",
        solid: true,
        transparent: false
    },

    mud: {
        name: "Schlamm",
        color: "#5c4937",
        solid: true,
        transparent: false
    },

    snow: {
        name: "Schnee",
        color: "#eef8ff",
        solid: true,
        transparent: false
    },

    oakLog: {
        name: "Eichenstamm",
        color: "#87552c",
        solid: true,
        transparent: false
    },

    birchLog: {
        name: "Birkenstamm",
        color: "#bda681",
        solid: true,
        transparent: false
    },

    spruceLog: {
        name: "Fichtenstamm",
        color: "#674022",
        solid: true,
        transparent: false
    },

    oakLeaves: {
        name: "Eichenlaub",
        color: "#37894a",
        solid: true,
        transparent: true
    },

    birchLeaves: {
        name: "Birkenlaub",
        color: "#51a660",
        solid: true,
        transparent: true
    },

    spruceLeaves: {
        name: "Fichtenlaub",
        color: "#2d713c",
        solid: true,
        transparent: true
    },

    cactus: {
        name: "Kaktus",
        color: "#3f9046",
        solid: true,
        transparent: false
    },

    clay: {
        name: "Ton",
        color: "#b77770",
        solid: true,
        transparent: false
    },

    brick: {
        name: "Ziegel",
        color: "#a94d3b",
        solid: true,
        transparent: false
    },

    glass: {
        name: "Glas",
        color: "#7bd8e8",
        solid: true,
        transparent: true
    },

    glow: {
        name: "Leuchtblock",
        color: "#f4c84b",
        solid: true,
        transparent: false
    },

    ice: {
        name: "Eis",
        color: "#a7dce9",
        solid: true,
        transparent: true
    },

    sponge: {
        name: "Schwamm",
        color: "#f1e766",
        solid: true,
        transparent: false
    },

    obsidian: {
        name: "Obsidian",
        color: "#2b2037",
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
        color: "#d85b28",
        solid: false,
        transparent: true
    }
};

const HOTBAR = [
    "grass",
    "dirt",
    "stone",
    "sand",
    "sandstone",
    "gravel",
    "mud",
    "snow",
    "oakLog",
    "birchLog",
    "spruceLog",
    "oakLeaves",
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
   BLOCK-HILFSFUNKTIONEN
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

function fluidBlock(type, level = 8) {
    return {
        id: type,
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
    const id = getBlockId(x, y, z);

    return (
        id !== "air" &&
        id !== "water" &&
        id !== "lava" &&
        BLOCKS[id] &&
        BLOCKS[id].solid
    );
}

/* =========================================================
   ZUFALL UND BIOME
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

function noise(x, z) {
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
    const large = noise(
        x * 0.045,
        z * 0.045
    );

    const medium = noise(
        x * 0.1,
        z * 0.1
    );

    return Math.max(
        2,
        Math.min(
            WORLD_HEIGHT - 4,
            Math.floor(
                3 +
                large * 10 +
                medium * 4
            )
        )
    );
}

function getBiome(x, z) {
    const temperature = noise(
        x * 0.018 + 400,
        z * 0.018 + 400
    );

    const humidity = noise(
        x * 0.018 + 800,
        z * 0.018 + 800
    );

    if (
        temperature < 0.28
    ) {
        return "snow";
    }

    if (
        humidity < 0.27
    ) {
        return "desert";
    }

    if (
        humidity > 0.74
    ) {
        return "swamp";
    }

    if (
        temperature > 0.72 &&
        humidity < 0.48
    ) {
        return "savanna";
    }

    return "forest";
}

function biomeName(biome) {
    const names = {
        forest: "WALD",
        desert: "WUESTE",
        snow: "SCHNEE",
        swamp: "SUMPF",
        savanna: "SAVANNE"
    };

    return names[biome] || "WALD";
}

/* =========================================================
   CHUNKS UND WELT
========================================================= */

function chunkCoordinate(value) {
    return Math.floor(
        value / CHUNK_SIZE
    );
}

function chunkId(cx, cz) {
    return `${cx},${cz}`;
}

function createTree(x, y, z, type) {
    const treeData = {
        oak: {
            log: "oakLog",
            leaves: "oakLeaves"
        },
        birch: {
            log: "birchLog",
            leaves: "birchLeaves"
        },
        spruce: {
            log: "spruceLog",
            leaves: "spruceLeaves"
        }
    };

    const data =
        treeData[type] ||
        treeData.oak;

    const height =
        3 + Math.floor(
            random2D(x, z, 20) * 3
        );

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
                id: data.log,
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
                            id: data.leaves,
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

    if (
        chunks.has(id)
    ) {
        return;
    }

    const startX =
        cx * CHUNK_SIZE;

    const startZ =
        cz * CHUNK_SIZE;

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
            const x =
                startX + localX;

            const z =
                startZ + localZ;

            const height =
                terrainHeight(x, z);

            const biome =
                getBiome(x, z);

            for (
                let y = 0;
                y <= height;
                y++
            ) {
                let blockId =
                    "stone";

                if (
                    y === height
                ) {
                    if (
                        biome === "desert"
                    ) {
                        blockId = "sand";
                    } else if (
                        biome === "snow"
                    ) {
                        blockId = "snow";
                    } else if (
                        biome === "swamp"
                    ) {
                        blockId = "mud";
                    } else {
                        blockId = "grass";
                    }
                } else if (
                    y >= height - 2
                ) {
                    if (
                        biome === "desert"
                    ) {
                        blockId =
                            y === height - 2
                                ? "sandstone"
                                : "sand";
                    } else if (
                        biome === "swamp"
                    ) {
                        blockId = "mud";
                    } else {
                        blockId = "dirt";
                    }
                }

                setBlock(
                    x,
                    y,
                    z,
                    {
                        id: blockId,
                        solid: true,
                        transparent:
                            BLOCKS[blockId].transparent
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
                        fluidBlock(
                            "water"
                        )
                    );
                }
            }

            const treeChance =
                random2D(x, z, 40);

            if (
                biome === "forest" &&
                height > SEA_LEVEL + 1 &&
                treeChance > 0.9
            ) {
                createTree(
                    x,
                    height + 1,
                    z,
                    "oak"
                );
            }

            if (
                biome === "snow" &&
                height > SEA_LEVEL + 1 &&
                treeChance > 0.93
            ) {
                createTree(
                    x,
                    height + 1,
                    z,
                    "spruce"
                );
            }

            if (
                biome === "savanna" &&
                height > SEA_LEVEL + 1 &&
                treeChance > 0.94
            ) {
                createTree(
                    x,
                    height + 1,
                    z,
                    "birch"
                );
            }

            if (
                biome === "desert" &&
                height > SEA_LEVEL &&
                treeChance > 0.94
            ) {
                setBlock(
                    x,
                    height + 1,
                    z,
                    {
                        id: "cactus",
                        solid: true,
                        transparent: false
                    }
                );
            }

            if (
                random2D(x, z, 90) > 0.985
            ) {
                setBlock(
                    x,
                    3,
                    z,
                    fluidBlock(
                        "lava"
                    )
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
        const [
            id,
            chunk
        ] of chunks.entries()
    ) {
        const distance =
            Math.max(
                Math.abs(
                    chunk.cx - centerX
                ),
                Math.abs(
                    chunk.cz - centerZ
                )
            );

        if (
            distance >
            VIEW_DISTANCE + 1
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
        let cx =
            centerX - VIEW_DISTANCE;
        cx <=
            centerX + VIEW_DISTANCE;
        cx++
    ) {
        for (
            let cz =
                centerZ - VIEW_DISTANCE;
            cz <=
                centerZ + VIEW_DISTANCE;
            cz++
        ) {
            generateChunk(
                cx,
                cz
            );
        }
    }

    unloadFarChunks(
        centerX,
        centerZ
    );

    updateBiomeText();
}

/* =========================================================
   PIXELTEXTUREN
========================================================= */

function parseColor(hex) {
    const value =
        hex.replace("#", "");

    return {
        r: parseInt(
            value.slice(0, 2),
            16
        ),
        g: parseInt(
            value.slice(2, 4),
            16
        ),
        b: parseInt(
            value.slice(4, 6),
            16
        )
    };
}

function colorRgb(color, amount = 0) {
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
        parseColor(
            BLOCKS[blockId].color
        );

    context.fillStyle =
        colorRgb(base);

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
                    ? -25
                    : random > 0.84
                        ? 24
                        : random > 0.68
                            ? 9
                            : 0;

            context.fillStyle =
                colorRgb(
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
        blockId.includes("Log")
    ) {
        context.fillStyle =
            "#432717";

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
        blockId.includes("Leaves")
    ) {
        context.fillStyle =
            "#1f5e31";

        for (
            let i = 0;
            i < 28;
            i++
        ) {
            context.fillRect(
                Math.floor(
                    random2D(
                        i,
                        4,
                        23
                    ) * 16
                ),
                Math.floor(
                    random2D(
                        i,
                        8,
                        24
                    ) * 16
                ),
                1,
                1
            );
        }
    }

    if (
        blockId === "grass"
    ) {
        context.fillStyle =
            "#2e8738";

        for (
            let i = 0;
            i < 35;
            i++
        ) {
            context.fillRect(
                Math.floor(
                    random2D(
                        i,
                        4,
                        25
                    ) * 16
                ),
                Math.floor(
                    random2D(
                        i,
                        8,
                        26
                    ) * 5
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
            "#5b271f";

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

const FACES = [
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

function isFaceVisible(x, y, z, normal) {
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
    const root =
        new THREE.Group();

    const blockFaces =
        new Map();

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

                if (
                    !blockFaces.has(
                        block.id
                    )
                ) {
                    blockFaces.set(
                        block.id,
                        []
                    );
                }

                for (
                    const face of FACES
                ) {
                    if (
                        isFaceVisible(
                            x,
                            y,
                            z,
                            face.normal
                        )
                    ) {
                        blockFaces
                            .get(block.id)
                            .push({
                                x,
                                y,
                                z,
                                face
                            });
                    }
                }
            }
        }
    }

    for (
        const [
            blockId,
            list
        ] of blockFaces.entries()
    ) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        for (
            const item of list
        ) {
            const start =
                positions.length / 3;

            for (
                const corner
                of item.face.corners
            ) {
                positions.push(
                    item.x + corner[0],
                    item.y + corner[1],
                    item.z + corner[2]
                );

                normals.push(
                    item.face.normal[0],
                    item.face.normal[1],
                    item.face.normal[2]
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
                map: createTexture(
                    blockId
                ),
                color: 0xffffff,
                roughness:
                    blockId === "water" ||
                    blockId === "lava"
                        ? 0.12
                        : 0.9,
                transparent:
                    blockId === "water" ||
                    blockId === "lava" ||
                    blockId === "glass" ||
                    blockId.includes(
                        "Leaves"
                    ),
                opacity:
                    blockId === "water"
                        ? 0.58
                        : blockId === "lava"
                            ? 0.86
                            : blockId === "glass"
                                ? 0.45
                                : blockId.includes(
                                    "Leaves"
                                )
                                    ? 0.88
                                    : 1,
                side: THREE.DoubleSide
            });

        if (
            blockId === "glow" ||
            blockId === "lava"
        ) {
            material.emissive =
                new THREE.Color(
                    BLOCKS[blockId].color
                );

            material.emissiveIntensity =
                blockId === "lava"
                    ? 0.5
                    : 0.8;
        }

        const mesh =
            new THREE.Mesh(
                geometry,
                material
            );

        mesh.userData.blockId =
            blockId;

        root.add(mesh);
    }

    root.userData.chunk =
        chunk;

    return root;
}

function disposeObject(object) {
    object.traverse(
        child => {
            if (
                child.geometry
            ) {
                child.geometry.dispose();
            }

            if (
                child.material
            ) {
                child.material.dispose();
            }
        }
    );
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
        disposeObject(old);
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
        chunkMeshes.set(
            id,
            mesh
        );
    }
}

function rebuildAllChunks() {
    for (
        const mesh
        of chunkMeshes.values()
    ) {
        worldGroup.remove(mesh);
        disposeObject(mesh);
    }

    chunkMeshes.clear();

    for (
        const chunk
        of chunks.values()
    ) {
        rebuildChunk(
            chunk.cx,
            chunk.cz
        );
    }
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

/* =========================================================
   THREE.JS UND PERFORMANCE
========================================================= */

function initThree() {
    scene =
        new THREE.Scene();

    scene.background =
        new THREE.Color(
            0x82c7e9
        );

    scene.fog =
        new THREE.Fog(
            0x82c7e9,
            12,
            40
        );

    camera =
        new THREE.PerspectiveCamera(
            75,
            window.innerWidth /
            window.innerHeight,
            0.05,
            120
        );

    renderer =
        new THREE.WebGLRenderer({
            antialias: false,
            powerPreference:
                "high-performance"
        });

    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio || 1,
            1
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
            1.2
        )
    );

    const light =
        new THREE.DirectionalLight(
            0xffffff,
            1.1
        );

    light.position.set(
        20,
        35,
        15
    );

    scene.add(light);

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
            1
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

function collides(position) {
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
        paused ||
        inventoryOpen
    ) {
        return;
    }

    moveVector.set(
        0,
        0,
        0
    );

    if (
        pressed("KeyW")
    ) {
        moveVector.z -= 1;
    }

    if (
        pressed("KeyS")
    ) {
        moveVector.z += 1;
    }

    if (
        pressed("KeyA")
    ) {
        moveVector.x -= 1;
    }

    if (
        pressed("KeyD")
    ) {
        moveVector.x += 1;
    }

    if (
        moveVector.lengthSq() > 0
    ) {
        moveVector.normalize();

        const forward =
            new THREE.Vector3(
                Math.sin(yaw),
                0,
                Math.cos(yaw)
            );

        sideVector.set(
            Math.cos(yaw),
            0,
            -Math.sin(yaw)
        );

        const dx =
            sideVector.x *
            moveVector.x +
            forward.x *
            moveVector.z;

        const dz =
            sideVector.z *
            moveVector.x +
            forward.z *
            moveVector.z;

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
            Math.pow(
                0.001,
                delta
            );

        velocity.z *=
            Math.pow(
                0.001,
                delta
            );
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

        touchKeys.jump =
            false;
    }

    const old =
        player.position.clone();

    player.position.x +=
        velocity.x * delta;

    if (
        collides(
            player.position
        )
    ) {
        player.position.x =
            old.x;

        velocity.x =
            0;
    }

    player.position.z +=
        velocity.z * delta;

    if (
        collides(
            player.position
        )
    ) {
        player.position.z =
            old.z;

        velocity.z =
            0;
    }

    player.position.y +=
        velocity.y * delta;

    if (
        collides(
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

        velocity.y =
            0;
    } else {
        grounded =
            false;
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

/* =========================================================
   KAMERA UND TOUCH
========================================================= */

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

function handleMouseDown(event) {
    if (
        !gameActive ||
        paused ||
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
        paused ||
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

let cameraTouchId = null;
let lastTouchX = 0;
let lastTouchY = 0;
let touchOnUI = false;

function isTouchUI(target) {
    return Boolean(
        target.closest(
            "#touchControls"
        ) ||
        target.closest(
            "#hotbar"
        ) ||
        target.closest(
            "#menu"
        ) ||
        target.closest(
            "#pause"
        ) ||
        target.closest(
            "#inventory"
        )
    );
}

document.addEventListener(
    "touchstart",
    event => {
        if (
            !gameActive ||
            paused ||
            inventoryOpen
        ) {
            return;
        }

        const touch =
            event.changedTouches[0];

        touchOnUI =
            isTouchUI(
                event.target
            );

        if (
            touchOnUI
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
            touchOnUI
        ) {
            return;
        }

        let touch =
            null;

        for (
            const item
            of event.changedTouches
        ) {
            if (
                item.identifier ===
                cameraTouchId
            ) {
                touch = item;
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
            const item
            of event.changedTouches
        ) {
            if (
                item.identifier ===
                cameraTouchId
            ) {
                cameraTouchId =
                    null;

                touchOnUI =
                    false;
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
        cameraTouchId =
            null;

        touchOnUI =
            false;
    },
    {
        passive: false
    }
);

/* =========================================================
   BLOCK-ZIEL UND PLATZIEREN
========================================================= */

function getTarget() {
    const ray =
        new THREE.Raycaster();

    ray.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    ray.far =
        REACH;

    const hits =
        ray.intersectObject(
            worldGroup,
            true
        );

    if (
        hits.length === 0
    ) {
        return null;
    }

    const hit =
        hits[0];

    const normal =
        hit.face.normal.clone();

    const inside =
        hit.point.clone().addScaledVector(
            normal,
            -0.01
        );

    const outside =
        hit.point.clone().addScaledVector(
            normal,
            0.01
        );

    return {
        block: {
            x: Math.floor(
                inside.x
            ),
            y: Math.floor(
                inside.y
            ),
            z: Math.floor(
                inside.z
            )
        },

        place: {
            x: Math.floor(
                outside.x
            ),
            y: Math.floor(
                outside.y
            ),
            z: Math.floor(
                outside.z
            )
        }
    };
}

function breakBlock() {
    const target =
        getTarget();

    if (
        !target ||
        target.block.y <= 0
    ) {
        return;
    }

    setBlock(
        target.block.x,
        target.block.y,
        target.block.z,
        airBlock()
    );

    rebuildAround(
        target.block.x,
        target.block.z
    );
}

function placeBlock() {
    const target =
        getTarget();

    if (
        !target
    ) {
        return;
    }

    const x =
        target.place.x;

    const y =
        target.place.y;

    const z =
        target.place.z;

    if (
        getBlockId(
            x,
            y,
            z
        ) !== "air"
    ) {
        return;
    }

    const blockId =
        HOTBAR[selectedSlot];

    const block =
        blockId === "water" ||
        blockId === "lava"
            ? fluidBlock(
                blockId
            )
            : {
                id: blockId,
                solid:
                    BLOCKS[blockId].solid,
                transparent:
                    BLOCKS[blockId].transparent
            };

    setBlock(
        x,
        y,
        z,
        block
    );

    if (
        collides(
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

    rebuildAround(
        x,
        z
    );
}

/* =========================================================
   WASSER UND LAVA
========================================================= */

function updateFluid(type) {
    const changes = [];
    let count = 0;

    for (
        const [
            id,
            block
        ] of world.entries()
    ) {
        if (
            block.id !== type
        ) {
            continue;
        }

        count++;

        if (
            count > (
                type === "water"
                    ? 18
                    : 8
            )
        ) {
            break;
        }

        const [
            x,
            y,
            z
        ] = id
            .split(",")
            .map(Number);

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
                block: fluidBlock(
                    type
                )
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

        const sides = [
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
            ] of sides
        ) {
            if (
                getBlockId(
                    nx,
                    ny,
                    nz
                ) === "air"
            ) {
                changes.push({
                    x: nx,
                    y: ny,
                    z: nz,
                    block: fluidBlock(
                        type,
                        nextLevel
                    )
                });
            }
        }
    }

    const dirty =
        new Set();

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

        dirty.add(
            chunkId(
                chunkCoordinate(
                    change.x
                ),
                chunkCoordinate(
                    change.z
                )
            )
        );
    }

    for (
        const id
        of dirty
    ) {
        const [
            cx,
            cz
        ] = id
            .split(",")
            .map(Number);

        rebuildChunk(
            cx,
            cz
        );
    }
}

/* =========================================================
   INVENTAR UND HOTBAR
========================================================= */

function createPreview(blockId) {
    const element =
        document.createElement(
            "div"
        );

    element.className =
        "preview";

    element.style.background =
        BLOCKS[blockId].color;

    return element;
}

function updateHotbar() {
    const hotbar =
        document.getElementById(
            "hotbar"
        );

    hotbar.innerHTML = "";

    HOTBAR.forEach(
        (
            blockId,
            index
        ) => {
            const slot =
                document.createElement(
                    "div"
                );

            slot.className =
                "slot";

            if (
                index === selectedSlot
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

            slot.appendChild(
                number
            );

            slot.appendChild(
                createPreview(
                    blockId
                )
            );

            slot.appendChild(
                count
            );

            slot.addEventListener(
                "click",
                () => {
                    selectedSlot =
                        index;

                    updateHotbar();
                    showSelected();
                }
            );

            hotbar.appendChild(
                slot
            );
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
            HOTBAR[selectedSlot]
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
            blockId => {
                const item =
                    document.createElement(
                        "button"
                    );

                item.appendChild(
                    createPreview(
                        blockId
                    )
                );

                item.appendChild(
                    document.createTextNode(
                        BLOCKS[blockId].name
                    )
                );

                item.addEventListener(
                    "click",
                    () => {
                        const index =
                            HOTBAR.indexOf(
                                blockId
                            );

                        if (
                            index >= 0
                        ) {
                            selectedSlot =
                                index;

                            updateHotbar();
                        }

                        closeInventory();
                    }
                );

                grid.appendChild(
                    item
                );
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

function bindTouchButton(
    id,
    action
) {
    const button =
        document.getElementById(
            id
        );

    button.addEventListener(
        "touchstart",
        event => {
            event.preventDefault();
            event.stopPropagation();
            touchKeys[action] =
                true;
        },
        {
            passive: false
        }
    );

    button.addEventListener(
        "touchend",
        event => {
            event.preventDefault();
            event.stopPropagation();
            touchKeys[action] =
                false;
        },
        {
            passive: false
        }
    );

    button.addEventListener(
        "touchcancel",
        event => {
            event.preventDefault();
            event.stopPropagation();
            touchKeys[action] =
                false;
        },
        {
            passive: false
        }
    );
}

bindTouchButton(
    "forward",
    "KeyW"
);

bindTouchButton(
    "left",
    "KeyA"
);

bindTouchButton(
    "back",
    "KeyS"
);

bindTouchButton(
    "right",
    "KeyD"
);

bindTouchButton(
    "jump",
    "jump"
);

document.getElementById(
    "breakButton"
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
    "placeButton"
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
    "inventoryButton"
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
        keys[event.code] =
            true;

        if (
            event.code === "Space" ||
            event.code.startsWith(
                "Arrow"
            )
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
            event.code.startsWith(
                "Digit"
            )
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
                selectedSlot =
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
        keys[event.code] =
            false;
    }
);

/* =========================================================
   MENÜS UND SPEICHERN
========================================================= */

function togglePause() {
    if (
        !gameActive ||
        inventoryOpen
    ) {
        return;
    }

    paused =
        !paused;

    document.getElementById(
        "pause"
    ).style.display =
        paused
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
    const raw =
        localStorage.getItem(
            "blockworld-save"
        );

    if (
        !raw
    ) {
        alert(
            "Keine Welt gespeichert."
        );

        return;
    }

    const data =
        JSON.parse(raw);

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

    paused =
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
    updateBiomeText();
}

function returnToMenu() {
    gameActive =
        false;

    paused =
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
   HUD UND LOOP
========================================================= */

function updateBiomeText() {
    const biome =
        getBiome(
            Math.floor(
                player.position.x
            ),
            Math.floor(
                player.position.z
            )
        );

    document.getElementById(
        "biome"
    ).textContent =
        biomeName(biome);
}

function updateHUD(delta) {
    document.getElementById(
        "hp"
    ).textContent =
        player.health;

    document.getElementById(
        "xyz"
    ).textContent =
        `${Math.floor(
            player.position.x
        )} / ${
            Math.floor(
                player.position.y
            )
        } / ${
            Math.floor(
                player.position.z
            )
        }`;

    updateBiomeText();

    fpsFrames++;
    fpsTimer += delta;

    if (
        fpsTimer >= 0.5
    ) {
        fps =
            Math.round(
                fpsFrames /
                fpsTimer
            );

        fpsFrames =
            0;

        fpsTimer =
            0;
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

    waterTimer += delta;

    if (
        waterTimer >=
        WATER_INTERVAL
    ) {
        waterTimer =
            0;

        updateFluid(
            "water"
        );
    }

    lavaTimer += delta;

    if (
        lavaTimer >=
        LAVA_INTERVAL
    ) {
        lavaTimer =
            0;

        updateFluid(
            "lava"
        );
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
    "mainMenu"
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