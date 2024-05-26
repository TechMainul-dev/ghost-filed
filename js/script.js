/*

  It's disco time!  
  This ghost wants to party all night long 👻
  But you can freeze him anytime you wish to!
  
  The only imported mesh here is the ghost, rest is parametric shapes created with Three.js.
  
  Special thanks to:
  
  Joshua Koo (@zz85)  - for the amazing path modifier
  https://zz85.github.io/threejs-path-flow/
  
  Masatatsu Nakamura (@mattatz) - for beautiful parametric trees geometry
  https://github.com/mattatz/THREE/Tree
  
  Cubemap by Emil Persson aka Humus
  
  art & code by 
  Anna Zenn Scavenger, May 2020
  https://twitter.com/ouchpixels
  
*/

let container, camera, scene, renderer;

const BITS = 3;
const TEXTURE_WIDTH = 256;

let ghost;
let texture, uniforms;
let bufferUniforms = {};

let modifierObject = new THREE.Object3D();
let referenceGeometry = new THREE.Geometry();
referenceGeometry.vertices = Array(2)
    .fill()
    .map((_) => new THREE.Vector3());

let splineHelperObjects = [],
    splineOutline;
let splinePointsLength = 4;
let positions = [];
let options;

let r = Math.random() * (Math.PI * 2 - -Math.PI) + -Math.PI;

let boxGeometry = new THREE.BoxGeometry(20, 20, 20);

let ARC_SEGMENTS = 200;
let splineMesh;
let splines = {};

// params for the curve + ghost

let params = {
    path: 0,
    flow: true,

    uniform: false,
    tension: 0.5,
    centripetal: false,
    chordal: false,

    closed: true,
    play: false,

    scale: 0.35,

    rotationX: 0,
    rotationY: 0.0,
    rotationZ: -0.5,

    translateX: 0,
    translateY: 30.0,
    translateZ: 0,

    wireframe: false,
};

let isMobile = /(Android|iPhone|iOS|iPod|iPad)/i.test(navigator.userAgent);

let windowRatio = window.innerWidth / window.innerHeight;
let isLandscape = windowRatio > 1 ? true : false;

let mouseX = 0;
let mouseY = 0;

let y_axis = new THREE.Vector3(0, 1, 0);
let quaternion = new THREE.Quaternion();

let isSceneFrozen = false;
let rotSpeed = 0.25;

const btnFreeze = document.querySelector('#btn-freeze');
const freezeTextBlur = document.querySelector('#freeze-text-blur');
const freezeTextTop = document.querySelector('#freeze-text-top');

window.onload = function () {
    init();
    printConsole();
};

function init() {
    container = document.querySelector('#container');

    scene = new THREE.Scene();
    const fogNear = isLandscape ? 1200 : 2200;
    const fogFar = isLandscape ? 4000 : 5500;
    scene.fog = new THREE.Fog(0x998a7d, fogNear, fogFar);

    createCamera();
    createLights();
    createRenderer();

    createTerrain();
    createTrees();

    // generate path for the ghost
    // air letters (tori) are positioned on path's control points
    createCurves();

    // * G-0-0-D * letters on the generated path
    createAirLetters();

    // * N-I-G-H-T * letters on the terrain
    createTerrainLetters();

    animate();

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('touchmove', onTouch, false);
    document.addEventListener('touchstart', onTouch, false);
    btnFreeze.addEventListener('click', freezeScene, false);
}

function createCamera() {
    camera = new THREE.PerspectiveCamera(
        40,
        window.innerWidth / window.innerHeight,
        1,
        5000,
    );
    const cameraY = isLandscape ? 170 : 400;
    const cameraZ = isLandscape ? 1850 : 1800 / windowRatio;
    camera.position.set(0, cameraY, cameraZ);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
}

function createLights() {
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.9);
    fillLight.position.set(80, 10, 200);

    const backLight = new THREE.DirectionalLight(0xff00ff, 1);
    backLight.position.set(200, 10, -55);

    let posZ = isLandscape ? 750 : 850;

    pointLight = new THREE.PointLight(0x0fc4b8, 7.5, 400, 2);
    pointLight.position.set(-300, 0, posZ);
    pointLight2 = new THREE.PointLight(0x0fc4b8, 7.5, 400, 2);
    pointLight2.position.set(300, 0, posZ);

    scene.add(fillLight, backLight, pointLight, pointLight2);
}

function createRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio > 1.75 ? 1.5 : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
}

function createMaterials() {
    const grey = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const blackBasic = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const brownSimple = isMobile
        ? new THREE.MeshBasicMaterial({ color: 0x594a3e })
        : new THREE.MeshLambertMaterial({ color: 0x5e4732 });
    const brown = new THREE.MeshLambertMaterial({ color: 0x5e4732 });
    const purpleFlat = new THREE.MeshLambertMaterial({ color: 0xff00ff });

    const purple = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        roughness: 0.4,
        metalness: 0.9,
    });
    purple.color.convertSRGBToLinear();

    const greyFlat = new THREE.MeshPhongMaterial({
        color: 0x200066,
        emissive: 0x54944,
        specular: 0x1d683f,
        shininess: 80,
        flatShading: true,
    });
    greyFlat.color.convertSRGBToLinear();

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('');

    const textureChrome = textureLoader.load(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/911157/matcap_chromeEye_128.jpg',
    );

    const textureSteel = textureLoader.load(
        'https://s3-us-west-2.amazonaws.com/s.cdpn.io/911157/matcap_steel_256.jpg',
    );

    const matcapChrome = new THREE.ShaderMaterial({
        transparent: false,
        flatShading: false,
        side: THREE.DoubleSide,
        uniforms: {
            tMatCap: {
                type: 't',
                value: textureChrome,
            },
        },
        vertexShader: document.querySelector('#matcap-vs').textContent,
        fragmentShader: document.querySelector('#matcap-fs').textContent,
        flatShading: false,
    });

    const matcapSteel = new THREE.ShaderMaterial({
        transparent: false,
        flatShading: false,
        side: THREE.DoubleSide,
        uniforms: {
            tMatCap: {
                type: 't',
                value: textureSteel,
            },
        },
        vertexShader: document.querySelector('#matcap-vs').textContent,
        fragmentShader: document.querySelector('#matcap-fs').textContent,
        flatShading: false,
    });

    // disco reflections

    const loader = new THREE.CubeTextureLoader();
    loader.setCrossOrigin('');
    loader.setPath('https://s3-us-west-2.amazonaws.com/s.cdpn.io/911157/');

    const textureCube = loader.load([
        'pisa1_px.jpg',
        'pisa1_nx.jpg',
        'pisa1_py.jpg',
        'pisa1_ny.jpg',
        'pisa1_pz.jpg',
        'pisa1_nz.jpg',
    ]);

    const disco = new THREE.MeshPhongMaterial({
        envMap: textureCube,
        color: 0xff00ff,
        emissive: 0xaa00aa,
        specular: 0x1d683f,
        flatShading: true,
    });

    // flaky material

    let phongShader = THREE.ShaderLib.standard;

    let fragmentShader = phongShader.fragmentShader;
    fragmentShader =
        document.querySelector('#flaky-fs-beforeMain').textContent +
        fragmentShader.replace(
            'vec4 diffuseColor = vec4( diffuse, opacity );',
            document.querySelector('#flaky-fs').textContent,
        );

    const flaky = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: THREE.UniformsUtils.merge([
            phongShader.uniforms,
            {
                uThreshold: {
                    value: 0.5,
                },
                uEdgeWidth: {
                    value: 0.0,
                },
                uEdgeColor: {
                    value: [255, 109, 203],
                },
                uColor: {
                    value: [255, 0, 255],
                },
                uFrequency: {
                    value: 0.95,
                },
            },
        ]),
        vertexShader: document.querySelector('#flaky-vs').textContent,
        fragmentShader: fragmentShader,
        lights: true,
        transparent: true,
    });

    return {
        blackBasic,
        grey,
        purple,
        purpleFlat,
        brown,
        brownSimple,
        matcapChrome,
        matcapSteel,
        disco,
        flaky,
        greyFlat,
    };
}

function createTerrain() {
    const materials = createMaterials();

    // just the wavy terrain
    const planeLength = isLandscape ? 3000 : 2500 / windowRatio;
    const planeGeom = new THREE.PlaneGeometry(2000, planeLength, 30, 30);

    const m = new THREE.Matrix4();
    m.makeRotationX(Math.PI * -0.5);
    planeGeom.applyMatrix(m);

    for (let i = 0; i < planeGeom.vertices.length; i++) {
        let vector = planeGeom.vertices[i];
        let ratio = noise.simplex3(vector.x * 0.1, vector.z * 0.1, 0.2);
        vector.y = ratio * 40;
    }

    const planeBufferGeom = new THREE.BufferGeometry().fromGeometry(planeGeom);

    const terrain = new THREE.Mesh(planeBufferGeom, materials.brown);
    terrain.position.y = -250;
    scene.add(terrain);

    // sprinkle terrain with points

    const pointVertices = planeBufferGeom.attributes.position.array;
    const pointVerticesArr = Array.prototype.slice.call(pointVertices);
    const halfPointVertices = pointVerticesArr.slice(
        Math.floor(pointVerticesArr.length / 2),
        pointVerticesArr.length,
    );

    const pointsGeom = new THREE.BufferGeometry();
    pointsGeom.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(halfPointVertices, 3),
    );
    const pointsMat = new THREE.PointsMaterial({ color: 0xff00ff, size: 6 });
    const terrainPoints = new THREE.Points(pointsGeom, pointsMat);
    terrainPoints.position.y = -250;

    scene.add(terrainPoints);

    // sprinkle terrain with little boxes

    let numBoxes = planeGeom.vertices.length;
    const boxBufferGeom = new THREE.BoxBufferGeometry(2.65, 2.65, 2.65);
    const instancedBoxGeom = new THREE.InstancedBufferGeometry().copy(
        boxBufferGeom,
    );
    const terrainBoxes = new THREE.InstancedMesh(
        instancedBoxGeom,
        materials.purpleFlat,
        numBoxes,
    );

    const dummy = new THREE.Object3D();

    for (let i = 0; i < numBoxes; i++) {
        dummy.position.set(
            noise.simplex3(i * 0.2, i * 0.5, 0.5) * 900,
            Math.random() * (-220 - -240) + -240,
            Math.random() * (1300 - -850) + -850,
        );

        dummy.rotation.set(
            Math.random() * (Math.PI * 1.95 - -Math.PI * 1.95) +
                -Math.PI * 1.95,
            Math.random() * (Math.PI * 1.95 - -Math.PI * 1.95) +
                -Math.PI * 1.95,
            0.0,
        );

        dummy.updateMatrix();
        terrainBoxes.setMatrixAt(i, dummy.matrix);
    }

    scene.add(terrainBoxes);
}

function createTrees() {
    const materials = createMaterials();

    const treeGenerations = isMobile ? 5 : 5;
    const tree = new THREE.Tree({
        generations: 5,
        length: 260.0,
        uvLength: 1200.0,
        radius: 14,
        radiusSegments: 6,
        heightSegments: 6,
    });

    const treeGeom = THREE.TreeGeometry.build(tree);
    const treeBufferGeom = new THREE.BufferGeometry().fromGeometry(treeGeom);
    // let treeArr = (Array.from(treeBufferGeom.attributes.position.array));
    // console.log(treeArr.join(','));

    // central big tree
    const treeMain = new THREE.Mesh(treeBufferGeom, materials.blackBasic);
    treeMain.position.y = -250;

    if (!isMobile) {
        // create tree sparkles

        const treePosition = treeBufferGeom.attributes.position.array;
        // change to a regular array
        const positionArr = Array.prototype.slice.call(treePosition);

        const positionPartArr = positionArr.slice(
            0,
            Math.floor(positionArr.length / 2),
        );
        const positionNoise = [];

        positionPartArr.forEach((pos) => {
            let p = pos + noise.simplex3(pos * 0.2, pos * 0.5, 0.5) * 20;
            positionNoise.push(p);
        });
    }

    // instanced background trees
    let numTrees = 7;

    const instancedTreeGeom = new THREE.InstancedBufferGeometry().copy(
        treeBufferGeom,
    );
    const treesBackground = new THREE.InstancedMesh(
        instancedTreeGeom,
        materials.brownSimple,
        numTrees,
    );
    treesBackground.matrixAutoUpdate = false;
    treesBackground.updateMatrix();

    const dummy = new THREE.Object3D();

    for (let i = 0; i < numTrees; i++) {
        dummy.position.set(
            noise.simplex3(i * 0.2, i * 0.5, 0.5) * 700,
            -250.0,
            -(Math.floor(Math.random() * 1000) + 500),
        );

        dummy.rotation.set(
            0.0,
            Math.random() * (Math.PI * 1.95 - -Math.PI * 1.95) +
                -Math.PI * 1.95,
            0.0,
        );

        dummy.updateMatrix();

        treesBackground.setMatrixAt(i, dummy.matrix);
    }

    scene.add(treeMain, treesBackground);
}

function createCurves() {
    for (let i = 0; i < splinePointsLength; i++) {
        addSplineObject(positions[i]);
    }

    positions = [];

    for (let i = 0; i < splinePointsLength; i++) {
        positions.push(splineHelperObjects[i].position);
    }

    const geometry = new THREE.Geometry();

    for (let i = 0; i < ARC_SEGMENTS; i++) {
        geometry.vertices.push(new THREE.Vector3());
    }

    // Centripetal curve
    curve = new THREE.CatmullRomCurve3(positions, true);
    curve.curveType = 'centripetal';
    curve.mesh = new THREE.Line(
        geometry.clone(),
        new THREE.LineBasicMaterial({
            color: 0x00ff00,
            opacity: 0.35,
            linewidth: 2,
        }),
    );
    curve.closed = true;
    splines.centripetal = curve;

    for (let k in splines) {
        let spline = splines[k];
        scene.add(spline.mesh);
    }

    // through these points flies the ghost

    let controlPoints = [
        // letter D
        new THREE.Vector3(420, 120, 0),
        // additional point
        new THREE.Vector3(-70, 200, 750),
        // letter G
        new THREE.Vector3(-440, 100, 150),
        // letter O
        new THREE.Vector3(-250, 440, -395),
        // additional point
        // new THREE.Vector3(0, 600, -700),
        new THREE.Vector3(-20, 600, -590),
        // letter O2
        new THREE.Vector3(200, 500, -380),
    ];

    load(controlPoints);

    initPathShader();
}

function createGeometries() {
    const torus = new THREE.TorusBufferGeometry(140, 40, 16, 46);
    const halfTorus = new THREE.TorusBufferGeometry(70, 25, 10, 20, Math.PI);

    const cylinderThin = new THREE.CylinderBufferGeometry(10, 10, 190, 8);
    const cylinderThick = new THREE.CylinderBufferGeometry(30, 30, 150, 22, 1);
    const cylinderThick2 = new THREE.CylinderBufferGeometry(
        30,
        30,
        150,
        22,
        22,
    );

    const sphere = new THREE.SphereBufferGeometry(50, 24, 12);
    const halfSphere = new THREE.SphereBufferGeometry(50, 28, 8, 0, Math.PI);
    const halfSphere2 = new THREE.SphereBufferGeometry(55, 28, 8, 0, Math.PI);
    const cone = new THREE.ConeBufferGeometry(40, 110, 20);

    // hook 1 - merged geoms
    const halfTorusThin = new THREE.TorusBufferGeometry(
        85,
        10,
        12,
        50,
        Math.PI,
    );
    halfTorusThin.rotateX(Math.PI);
    let radius = halfTorusThin.parameters.radius;
    let cylinderHeight = cylinderThin.parameters.height;
    halfTorusThin.translate(-radius, -cylinderHeight / 2, 0);
    const hook = THREE.BufferGeometryUtils.mergeBufferGeometries(
        [halfTorusThin, cylinderThin],
        true,
    );

    // hook2 - merged geoms
    const cylinderD = new THREE.CylinderBufferGeometry(10, 10, 350, 10);
    const halfTorusD = new THREE.TorusBufferGeometry(
        70,
        10,
        12,
        50,
        Math.PI / 2,
    );
    halfTorusD.rotateX(Math.PI);
    halfTorusD.rotateZ(-Math.PI / 2);
    let radiusD = halfTorusD.parameters.radius;
    let heightCylinderD = cylinderD.parameters.height;
    halfTorusD.translate(radiusD, -heightCylinderD / 2, 0);
    let hook2 = THREE.BufferGeometryUtils.mergeBufferGeometries(
        [cylinderD, halfTorusD],
        true,
    );

    return {
        torus,
        halfTorus,
        cylinderThin,
        cylinderThick,
        cylinderThick2,
        sphere,
        halfSphere,
        halfSphere2,
        cone,
        hook,
        hook2,
    };
}

function createStarGeometry() {
    const extrudeSettings = {
        steps: 2,
        depth: 2.5,
        bevelEnabled: true,
        bevelThickness: 0,
        bevelSize: 2,
        bevelOffset: 0,
        bevelSegments: 1,
    };

    let pts = [],
        numPts = 7;

    for (let i = 0; i < numPts * 2; i++) {
        let l = i % 2 == 1 ? 4 : 15;
        let a = (i / numPts) * Math.PI;
        pts.push(new THREE.Vector2(Math.cos(a) * l, Math.sin(a) * l));
    }

    const starShape = new THREE.Shape(pts);
    const starGeom = new THREE.ExtrudeBufferGeometry(
        starShape,
        extrudeSettings,
    );

    return starGeom;
}

function createAirLetters() {
    const materials = createMaterials();
    const geometries = createGeometries();

    console.log(positions);

    glowMeshArr = [];

    // 4 tori - air letters
    const letterPositions = [
        positions[0],
        positions[2],
        positions[3],
        positions[5],
    ];

    const torus = new THREE.Mesh(geometries.torus, materials.grey);

    for (let i = 0; i < letterPositions.length; i++) {
        let glowMesh = new THREEx.GeometricGlowMesh(torus);
        glowMesh.isGlowing = false;
        glowMesh.insideMesh.position.copy(letterPositions[i]);
        torus.position.copy(letterPositions[i]);
        glowMeshArr.push(glowMesh);
        // glowMesh.insideMesh.matrixAutoUpdate = false;
        // glowMesh.insideMesh.updateMatrix();
        scene.add(glowMesh.insideMesh);
    }

    // letter G

    hookG = new THREE.Mesh(geometries.hook, materials.matcapChrome);
    hookG.position.set(-310, -40, 150);
    hookG.matrixAutoUpdate = false;
    hookG.updateMatrix();
    scene.add(hookG);

    const starGeom = createStarGeometry();
    starG = new THREE.Mesh(starGeom, materials.matcapSteel);
    starG.position.set(-480, -124, 150);
    starG.rotation.z = Math.PI / 5;
    starG.scale.set(2.4, 2.4, 2.4);
    scene.add(starG);

    // letter D

    hookD = new THREE.Mesh(geometries.hook2, materials.matcapChrome);
    hookD.position.set(550, 210, 0);
    hookD.matrixAutoUpdate = false;
    hookD.updateMatrix();
    scene.add(hookD);

    starD = starG.clone();
    starD.position.set(550, 398, 0);
    starD.rotation.z = Math.PI / 5;
    scene.add(starD);
}

function createTerrainLetters() {
    const materials = createMaterials();
    const geometries = createGeometries();

    let posZ = isLandscape ? 850 : 950;

    // letter N

    const cylinderN = new THREE.Mesh(
        geometries.cylinderThick,
        materials.purple,
    );
    cylinderN.scale.y = 0.85;
    cylinderN.position.set(-360, -150, posZ);

    const cylinderN2 = new THREE.Mesh(
        geometries.cylinderThick,
        materials.purple,
    );
    cylinderN2.position.set(-230, -170, posZ);

    const halfSphereN = new THREE.Mesh(
        geometries.halfSphere,
        materials.matcapSteel,
    );
    halfSphereN.position.set(-200.6, -97, posZ);
    halfSphereN.scale.set(0.593, 0.593, 0.593);
    halfSphereN.rotation.x = -Math.PI / 2;
    scene.add(halfSphereN);

    discoBallN = new THREE.Mesh(geometries.sphere, materials.disco);
    discoBallN.position.set(-360, -50, posZ);
    discoBallN.scale.set(0.5, 0.5, 0.5);
    scene.add(discoBallN);

    const cylinderThinnerN = new THREE.Mesh(
        geometries.cylinderThin,
        materials.matcapSteel,
    );
    cylinderThinnerN.position.set(-360, -150, posZ);
    cylinderThinnerN.scale.set(0.4, 0.9, 0.4);
    scene.add(cylinderThinnerN);

    const cylinderThinN = new THREE.Mesh(
        geometries.cylinderThin,
        materials.matcapSteel,
    );
    cylinderThinN.position.set(-290, -170, posZ);
    cylinderThinN.scale.set(1.2, 0.8, 1.2);
    cylinderThinN.rotation.z = Math.PI / 4.5;

    const discN = new THREE.Mesh(
        geometries.cylinderThick,
        materials.matcapSteel,
    );
    discN.position.set(-360, -223, posZ);
    discN.scale.set(1.28, 0.125, 1.28);

    const discN2 = discN.clone();
    discN.position.set(-230, -240, posZ);

    const letterN = new THREE.Group();
    letterN.add(cylinderN, cylinderN2, cylinderThinN, discN, discN2);

    scene.add(letterN);

    // letter I

    discoBall = new THREE.Mesh(geometries.sphere, materials.disco);
    discoBall.position.set(-110, -70, posZ);

    ballCover = new THREE.Mesh(geometries.halfSphere, materials.purple);
    ballCover.material.side = THREE.DoubleSide;

    let halfRadius = ballCover.geometry.parameters.radius;
    ballCover.scale.set(1.15, 1.15, 1.15);
    ballCover.position.set(-110, -74 - halfRadius, posZ);
    ballCover.rotation.set(Math.PI / 2, -Math.PI / 2, 0);
    ballCover.geometry.applyMatrix(
        new THREE.Matrix4().makeTranslation(-halfRadius, 0, 0),
    );
    ballCover.updateMatrix();
    ballCover2 = ballCover.clone();
    ballCover2.position.copy(ballCover.position);
    ballCover2.rotation.z = Math.PI;
    ballCover2.rotation.y = Math.PI / 2;

    const cone = new THREE.Mesh(geometries.cone, materials.matcapSteel);
    cone.position.set(-110, -180, posZ);

    const letterI = new THREE.Group();
    letterI.add(cone, discoBall, ballCover, ballCover2);
    scene.add(letterI);

    // letter G

    const torusG = new THREE.Mesh(geometries.halfTorus, materials.purple);
    torusG.position.set(50, -160, posZ);
    torusG.rotation.z = Math.PI / 2;

    const hookG = new THREE.Mesh(geometries.hook, materials.matcapSteel);
    hookG.scale.set(0.3, 0.25, 0.8);
    hookG.position.set(70, -185, posZ);

    discoBallG = discoBallN.clone();
    discoBallG.position.set(50, -160, posZ);

    const letterG = new THREE.Group();
    letterG.add(torusG, hookG, discoBallG);
    scene.add(letterG);

    // letter H

    letterHLeft = new THREE.Group();
    letterHRight = new THREE.Group();

    const cylinderH = new THREE.Mesh(
        geometries.cylinderThick2,
        materials.flaky,
    );
    // cylinderH.position.set(140, -145, 850);
    cylinderH.position.set(140, -160, posZ);
    cylinderH.scale.set(1.0, 0.9, 1.0);

    const cylinderH2 = new THREE.Mesh(
        geometries.cylinderThick,
        materials.matcapSteel,
    );
    cylinderH2.scale.set(0.98, 0.88, 0.98);
    cylinderH2.position.copy(cylinderH.position);

    const discH = new THREE.Mesh(
        geometries.cylinderThick,
        materials.matcapSteel,
    );
    // discH.position.set(140, -72, 850);
    discH.position.set(140, -87, posZ);
    discH.scale.set(1.275, 0.08, 1.275);
    const discH2 = discN.clone();
    // discH2.position.set(140, -210, 850);
    discH2.position.set(140, -225, posZ);

    letterHLeft.add(cylinderH, cylinderH2, discH, discH2);

    letterHRight = letterHLeft.clone();
    letterHRight.position.set(120, 0, 0);

    const horizontalH = new THREE.Mesh(
        geometries.cylinderThin,
        materials.matcapSteel,
    );
    horizontalH.scale.set(1.2, 0.5, 1.2);
    horizontalH.rotation.z = Math.PI / 2;
    horizontalH.position.set(200, -155, posZ);

    const letterH = new THREE.Group();
    letterH.add(letterHLeft, letterHRight, horizontalH);

    scene.add(letterH);

    // letter T

    cylinderT = new THREE.Mesh(geometries.cylinderThin, materials.matcapSteel);
    cylinderT.scale.set(0.55, 0.725, 0.55);
    cylinderT.position.set(370, -40, posZ);
    cylinderT.rotation.z = Math.PI / 2;

    const cylinderT2 = cylinderN.clone();
    cylinderT2.position.set(370, -170, posZ);
    cylinderT2.scale.set(0.9, 0.75, 0.9);

    discoBallT = discoBallN.clone();
    discoBallT.position.set(370, -70, posZ);

    const letterT = new THREE.Group();
    letterT.add(cylinderT, cylinderT2, discoBallT);
    scene.add(letterT);

    lettersNightGroup = new THREE.Group();
}

/* updates */

function updateModel() {
    modifierObject.scale.setScalar(params.scale);
    modifierObject.rotation.x = params.rotationX * Math.PI;
    modifierObject.rotation.y = params.rotationY * Math.PI;
    modifierObject.rotation.z = params.rotationZ * Math.PI;
    modifierObject.position.x = params.translateX;
    modifierObject.position.y = params.translateY;
    modifierObject.position.z = params.translateZ;

    ghost.matrixAutoUpdate = false;
    modifierObject.updateMatrix();
    ghost.matrix.copy(modifierObject.matrix);

    moo = referenceGeometry.clone().applyMatrix(modifierObject.matrix);
    console.log('referenceGeom: ' + moo);

    // use x-axis aligned
    min = Math.min(...moo.vertices.map((v) => v.x));
    len = Math.max(...moo.vertices.map((v) => v.x)) - min;
    // console.log(len, min);

    updateUniform('spineOffset', -min);
    updateUniform('spineLength', len);

    updateSplineOutline();

    customMaterial.wireframe = params.wireframe;
}

function updateUniform(name, v) {
    if (!uniforms) {
        bufferUniforms[name] = v;
        console.log('buffering uniform value', name);
        return;
    }

    uniforms[name].value = v;
}

function updateSplineTexture() {
    if (!texture) return;

    splines.centripetal.arcLengthDivisions = 200;
    splines.centripetal.updateArcLengths();
    splineLen = splines.centripetal.getLength();
    let pathSegment = len / splineLen; // should clam max to 1

    // updateUniform('spineOffset', 0);
    updateUniform('pathSegment', pathSegment);

    let splineCurve = splines.centripetal;
    // uniform chordal centripetal
    let points = splineCurve.getSpacedPoints(TEXTURE_WIDTH - 1);
    // getPoints() - unequal arc lengths
    let frenetFrames = splineCurve.computeFrenetFrames(
        TEXTURE_WIDTH - 1,
        params.closed,
    );
    // console.log(frenetFrames);

    // console.log('points', points);
    for (let i = 0; i < TEXTURE_WIDTH; i++) {
        let pt = points[i];
        setTextureValue(i, pt.x, pt.y, pt.z, 0);
        pt = frenetFrames.tangents[i];
        setTextureValue(i, pt.x, pt.y, pt.z, 1);
        pt = frenetFrames.normals[i];
        setTextureValue(i, pt.x, pt.y, pt.z, 2);
        pt = frenetFrames.binormals[i];
        setTextureValue(i, pt.x, pt.y, pt.z, 3);
    }

    texture.needsUpdate = true;
}

function makeBox(position) {
    let material = new THREE.MeshLambertMaterial({
        color: Math.random() * 0xffffff,
    });
    let object = new THREE.Mesh(boxGeometry, material);

    if (position) {
        object.position.copy(position);
    } else {
        object.position.x = Math.random() * 1000 - 500;
        object.position.y = Math.random() * 500;
        object.position.z = Math.random() * 800 - 400;
    }

    // scene.add( object );

    return object;
}

function addSplineObject(position) {
    let object = makeBox(position);
    splineHelperObjects.push(object);
    return object;
}

function addPoint() {
    splinePointsLength++;

    positions.push(addSplineObject().position);

    updateSplineOutline();
}

function removePoint() {
    if (splinePointsLength <= 4) {
        return;
    }

    splinePointsLength--;
    positions.pop();
    scene.remove(splineHelperObjects.pop());

    updateSplineOutline();
}

function updateSplineOutline() {
    for (let k in splines) {
        let spline = splines[k];

        splineMesh = spline.mesh;

        for (let i = 0; i < ARC_SEGMENTS; i++) {
            let p = splineMesh.geometry.vertices[i];
            let t = i / (ARC_SEGMENTS - 1);
            spline.getPoint(t, p);
        }

        splineMesh.geometry.verticesNeedUpdate = true;
    }

    updateSplineTexture();
}

function load(new_positions) {
    while (new_positions.length > positions.length) {
        addPoint();
    }

    while (new_positions.length < positions.length) {
        removePoint();
    }

    for (let i = 0; i < positions.length; i++) {
        positions[i].copy(new_positions[i]);
    }

    updateSplineOutline();
}

function updateGlow(mesh) {
    insideUniforms = mesh.insideMesh.material.uniforms;

    mesh.isGlowing = !mesh.isGlowing;

    mesh.isGlowing
        ? insideUniforms.glowColor.value.set(0xca00e5)
        : insideUniforms.glowColor.value.set(0x8d8d8d);

    mesh.isGlowing
        ? (insideUniforms.coeficient.value = 1.4)
        : (insideUniforms.coeficient.value = 1.0);

    if (currentMesh == glowMeshArr[1]) {
        mesh.isGlowing
            ? (hookG.material = createMaterials().purple)
            : (hookG.material = createMaterials().matcapChrome);
    } else if (currentMesh == glowMeshArr[0]) {
        mesh.isGlowing
            ? (hookD.material = createMaterials().purple)
            : (hookD.material = createMaterials().matcapChrome);
    }

    console.log(`Mesh is glowing: ${mesh.isGlowing}`);
}

function freezeScene() {
    params.play = false;

    if (!isSceneFrozen) {
        params.play = false;
        isSceneFrozen = !isSceneFrozen;

        freezeTextTop.style.stroke = '#63639f';
        freezeTextBlur.style.stroke = '#5959ff';
    } else {
        params.play = true;
        isSceneFrozen = !isSceneFrozen;

        freezeTextBlur.style.stroke = '#b0b0b0';
        freezeTextTop.style.stroke = '#b0b0b0';
    }
}

function animate() {
    requestAnimationFrame(animate);
    render();

    if (isSceneFrozen) {
        camera.lookAt(scene.position);
        let angle = 0.001 * mouseX;
        camera.position.applyQuaternion(
            quaternion.setFromAxisAngle(y_axis, angle),
        );
    } else if (params.play) {
        transformLetters();

        params.path += 0.005;
        params.path %= 1;
        updateUniform('pathOffset', params.path);

        let offset = params.path.toFixed(3);

        pointLight.intensity = 3.25 + Math.abs(mouseX) * 4.75;
        pointLight2.intensity = 3.25 + Math.abs(mouseX) * 4.75;

        // current mesh is the letter which a ghost flies through

        // kinda dirty way :P
        if (offset == 0.25) {
            currentMesh = glowMeshArr[1];
            updateGlow(currentMesh);
        } else if (offset == 0.5) {
            currentMesh = glowMeshArr[2];
            updateGlow(currentMesh);
        } else if (offset == 0.65) {
            currentMesh = glowMeshArr[3];
            updateGlow(currentMesh);
        } else if (offset == 0.92) {
            currentMesh = glowMeshArr[0];
            updateGlow(currentMesh);
        } else {
            return;
        }
    }
}

function transformLetters() {
    starG.rotation.y = mouseX * Math.PI;
    starD.rotation.y = -mouseX * Math.PI;

    // letter N
    discoBallN.rotation.y = -(mouseX * mouseX) * Math.PI * 0.5;

    // letter I
    discoBall.rotation.y = mouseX * Math.PI * 0.25;
    discoBall.material.emissive.r = 0.8 - Math.abs(mouseX * 0.78);
    ballCover.rotation.y =
        -Math.PI / 2 + (Math.PI / 1.85) * Math.abs(mouseX * mouseX);
    ballCover.scale.set(
        1.15 - 0.6 * Math.abs(mouseX * mouseX),
        1.15 - 0.85 * Math.abs(mouseX * mouseX),
        1.15 - 0.75 * Math.abs(mouseX * mouseX),
    );
    ballCover2.rotation.y =
        Math.PI / 2 - (Math.PI / 1.85) * Math.abs(mouseX * mouseX);
    ballCover2.scale.set(
        1.15 - 0.6 * Math.abs(mouseX * mouseX),
        1.15 - 0.85 * Math.abs(mouseX * mouseX),
        1.15 - 0.75 * Math.abs(mouseX * mouseX),
    );

    // letter G
    discoBallG.rotation.y = -mouseX * Math.PI;
    discoBallG.scale.set(0.5, 0.2 + 0.3 * Math.abs(mouseX), 0.5);

    // letter H
    letterHLeft.children[0].rotation.y = mouseX * Math.PI;
    letterHRight.children[0].rotation.y = -mouseX * Math.PI;

    // letter T
    discoBallT.rotation.y = -mouseX * Math.PI * 0.5;
    cylinderT.rotation.y = -mouseX * Math.PI * 0.25;
}

function render() {
    // uncomment to see the curve
    splines.centripetal.mesh.visible = params.centripetal;
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(e) {
    e.preventDefault();
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onTouch(e) {
    if (e.targetTouches && e.targetTouches[0]) {
        e.preventDefault();
        pointerEvent = e.targetTouches[0];
        mouseX = (pointerEvent.pageX / window.innerWidth) * 2 - 1;
    } else {
        return;
    }
}

function printConsole() {
    // console fun
    let styles = [
        'background: radial-gradient(circle, rgba(2,0,36,1) 0%, rgba(95,9,121,1) 35%, rgba(0,160,255,1) 100%);',
        'border: 1px solid #3E0E02',
        'color: white',
        'font-size: 16px',
        'font-family: Courier',
        ,
        'font-weight:bold',
        ,
        'display: block',
        'line-height: 50px',
        'text-align: center',
    ].join(';');
    setTimeout(
        console.log.bind(
            console,
            ` %c Number of draw calls: ${renderer.info.render.calls} 🎋`,
            styles,
        ),
    );
}
