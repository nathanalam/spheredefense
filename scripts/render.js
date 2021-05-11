import { handleCollisions } from "./utils.js";
import { Fighter } from "./objects/fighter.js";
import { Explosion } from "./objects/particles.js";
import { checkNewEnemy } from "./enemy.js";
import { Turret } from "./objects/turret.js";
import { Star } from "./objects/stars.js";
import { TrackballControls } from "./lib/TrackBallControls.js";
import { Board } from "./objects/board.js";
import { HoverLines, SelectFace } from "./objects/selection.js";
import { Tower } from "./objects/tower.js";
import { Troop } from "./objects/troops.js";
import { handleEnemyBehavior } from "./enemy.js";

let perspectiveCamera,
  board,
  controls,
  scene,
  renderer,
  cameraLight,
  raycaster,
  selectedTile,
  pointer,
  turretCount,
  fighter,
  tower,
  blobMeshes,
  entities,
  idToEntity,
  selectLines,
  selectFace,
  audioListener,
  meshPosition;

turretCount = 0;

const container = document.getElementById("viewcontainer");
const [width, height] = [window.innerWidth, window.innerHeight];
let adjLines = [];

// load a bunch of assets
const loader = new THREE.GLTFLoader();
const audioLoader = new THREE.AudioLoader();
audioListener = new THREE.AudioListener();
const loadWorld = () => {
  container.innerHTML = "Loading world...";
  loader.load(
    // resource URL
    `${siteurl}/models/globe.glb`,
    // called when resource is loaded
    function (model) {
      const object = model.scene;
      object.scale.multiplyScalar(9.3 * settings.WORLD_RADIUS);
      Board.planetModel = object;
      loadStar();
    },
    // called when loading is in progresses
    function (xhr) { },
    // called when loading has errors
    function (error) {
      console.log("An error occured while loading world");
    }
  );
};
const loadStar = () => {
  container.innerHTML = "Loading stars...";
  loader.load(
    // resource URL
    `${siteurl}/models/star.glb`,
    // called when resource is loaded
    function (model) {
      const object = model.scene;
      object.scale.multiplyScalar(100);
      Star.starModel = object;
      loadPlane();
    },
    // called when loading is in progresses
    function (xhr) { },
    // called when loading has errors
    function (error) {
      console.log("An error occured while loading stars");
    }
  );
};
const loadPlane = () => {
  container.innerHTML = "Loading plane...";
  loader.load(
    // resource URL
    `${siteurl}/models/spaceship.glb`,
    // called when resource is loaded
    function (model) {
      const object = model.scene;
      object.scale.multiplyScalar(100);
      object.rotateY(-Math.PI / 2);
      object.position.add(new THREE.Vector3(0, -4, -10));
      Fighter.planeModel = object;
      loadTower();
    },
    // called when loading is in progresses
    function (xhr) { },
    // called when loading has errors
    function (error) {
      console.log("An error occured while loading plane");
    }
  );
};
const loadTower = () => {
  container.innerHTML = "Loading tower...";
  loader.load(
    // resource URL
    `${siteurl}/models/rocket.glb`,
    // called when resource is loaded
    function (model) {
      const object = model.scene;
      object.scale.multiplyScalar(500, 500, 500);
      Tower.towerModel = object;
      loadTurret();
    },
    // called when loading is in progresses
    function (xhr) { },
    // called when loading has errors
    function (error) {
      console.log("An error occured while loading tower");
    }
  );
};

const loadTurret = () => {
  container.innerHTML = "Loading turret...";
  loader.load(
    // resource URL
    `${siteurl}/models/turret.glb`,
    // called when resource is loaded
    function (model) {
      const object = model.scene;
      object.scale.multiplyScalar(200, 200, 200);
      Turret.turretModel = object;
      loadTroop();
    },
    // called when loading is in progresses
    function (xhr) { },
    // called when loading has errors
    function (error) {
      console.log("An error occured while loading turret");
    }
  );
};

const loadTroop = () => {
  container.innerHTML = "Loading troop...";
  loader.load(
    // resource URL
    `${siteurl}/models/troop.glb`,
    // called when resource is loaded
    function (model) {
      const object = model.scene;
      object.scale.multiplyScalar(50);
      Troop.troopModel = object;
      loadShots();
    },
    // called when loading is in progresses
    function (xhr) { },
    // called when loading has errors
    function (error) {
      console.log("An error occured while loading troop");
    }
  );
};

const loadShots = () => {
  container.innerHTML = "Loading lasers...";
  audioLoader.load(`${siteurl}/sounds/laser.mp3`, function (buffer) {
    const sound = new THREE.Audio(audioListener);
    sound.setBuffer(buffer);
    sound.setLoop(false);
    sound.setVolume(0.5);
    Fighter.shootSound = sound;
    Turret.shootSound = sound;
    loadPop();
  });
};

const loadPop = () => {
  container.innerHTML = "Loading misc sounds...";
  audioLoader.load(`${siteurl}/sounds/pop.mp3`, function (buffer) {
    const sound = new THREE.Audio(audioListener);
    sound.setBuffer(buffer);
    sound.setLoop(false);
    sound.setVolume(0.5);
    Troop.hopSound = sound;
    Turret.placeSound = sound;
    loadSplat();
  });
};

const loadSplat = () => {
  container.innerHTML = "Loading misc sounds...";
  audioLoader.load(`${siteurl}/sounds/splat.mp3`, function (buffer) {
    const sound = new THREE.Audio(audioListener);
    sound.setBuffer(buffer);
    sound.setLoop(false);
    sound.setVolume(0.5);
    Troop.deathSound = sound;
    startGame();
  });
};

const startGame = () => {
  board = new Board();
  meshPosition = board.mesh.geometry.attributes.position;
  container.innerHTML = "";
  fighter = new Fighter(width / height);
  tower = new Tower(board.tiles[0]);
  blobMeshes = [];
  entities = [];
  idToEntity = new Map();
  selectLines = new HoverLines();
  selectFace = new SelectFace();
  scene = new THREE.Scene();
  pointer = new THREE.Vector2();

  init();
  animate();
};

loadWorld();

function init() {
  const aspect = width / height;

  perspectiveCamera = new THREE.PerspectiveCamera(60, aspect, 1, 1000000);
  perspectiveCamera.position.addScaledVector(board.tiles[0].centroid, 2);
  perspectiveCamera.add(audioListener);

  // world
  scene.background = new THREE.Color(0x1c1c1c);
  scene.fog = new THREE.FogExp2(0x1c1c1c, 0.00001);
  // scene.fog = new THREE.FogExp2(0x1c1c1c, 0.001);

  const axesHelper = new THREE.AxesHelper(1000);
  scene.add(axesHelper);

  // const cameraHelper = new THREE.CameraHelper(fighter.camera);
  // scene.add(cameraHelper);

  const stars = {};
  const starArr = [];
  const mesh = new THREE.Group();
  for (let i = 0; i < 500; i++) {
    const star = new Star();
    starArr.push(star);
    mesh.add(star.mesh);
  }
  stars.mesh = mesh;
  stars.timeStep = (time) => {
    starArr.forEach((child) => child.timeStep(time));
  };

  [fighter, stars, board, board.lines, selectLines, selectFace, tower].forEach(
    addEntity
  );

  // lights
  cameraLight = new THREE.DirectionalLight(0xffffff, 0.8);
  cameraLight.position.copy(perspectiveCamera.position);
  cameraLight.target.position.set(0, 0, 0);
  scene.add(cameraLight);

  const ambientLight = new THREE.AmbientLight(0x222222);
  scene.add(ambientLight);

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);
  //

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("click", onClick);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  createControls(perspectiveCamera);

  raycaster = new THREE.Raycaster();
}

function createControls(camera) {
  controls = new TrackballControls(camera, renderer.domElement);

  controls.rotateSpeed = 1.0;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;

  controls.keys = ["KeyA", "KeyS", "KeyD"];
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;

  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  controls.handleResize();
}
function onPointerMove(event) {
  pointer.set(
    (event.clientX / width) * 2 - 1,
    -(event.clientY / height) * 2 + 1
  );
  if (stats.phase === "flight") {
    const distSqFromCenter =
      (event.clientX - width / 2) ** 2 + (event.clientY - height / 2) ** 2;
    const radius = 0.25 * Math.min(width, height);
    const distSqFromCirc = distSqFromCenter - radius ** 2;
    if (distSqFromCirc <= 0) {
      const vector = new THREE.Vector3(pointer.x, pointer.y, -1);
      vector.unproject(fighter.camera);
      fighter.group.worldToLocal(vector);
      fighter.crosshairs.setTo(vector.multiplyScalar(2.5));

      fighter.updateVelocity(new THREE.Vector2(0, 0));
    } else {
      fighter.crosshairs.sprite.visible = false;
      const scalar = Math.sqrt(
        distSqFromCirc /
        ((width / 2 - radius) ** 2 + (height / 2 - radius) ** 2)
      );
      fighter.updateVelocity(
        pointer.clone().normalize().multiplyScalar(scalar)
      );
    }
  }
}

function onClick(event) {
  if (stats.phase === "flight") {
    Fighter.shootSound.play();
    const aimingToward =
      fighter.angularVel.x == 0 && fighter.angularVel.y == 0
        ? pointer
        : new THREE.Vector2(0, 0);
    raycaster.setFromCamera(aimingToward, fighter.camera);

    const intersects = raycaster.intersectObjects([board.mesh, ...blobMeshes]);

    if (intersects.length > 0) {
      // hit a tile
      const intersect = intersects[0];
      const entity = idToEntity.get(intersect.object.id);

      // remove blob hit
      if (entity.type == "TROOP") {
        console.log(entity);
        entity.health -= Fighter.damage;
      }
      const [leftBullet, rightBullet] = fighter.fireBulletsAt(intersect.point);
      addEntity(leftBullet);
      addEntity(rightBullet);
    } else {
      const vector = new THREE.Vector3(aimingToward.x, aimingToward.y, -1);
      vector.unproject(fighter.camera);
      fighter.group.worldToLocal(vector);
      const [leftBullet, rightBullet] = fighter.fireBulletsDirection(vector);
      addEntity(leftBullet);
      addEntity(rightBullet);
    }
  } else {
    const camera = perspectiveCamera;

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObject(board.mesh);

    if (intersects.length > 0) {
      // hit a tile
      const intersect = intersects[0];
      const tile = board.tiles[board.faceToTile[intersect.faceIndex]];

      if (selectedTile == board.faceToTile[intersect.faceIndex]) {
        // already highlighted

        if (tile.turret) {
          // clicked again on existing turret
          // scene.remove(tile.turret);
          // tile.turret = undefined;
          // turretCount -= 1;
        } else {
          // clicked again on empty space
          if (turretCount < settings.MAX_TURRETS) {
            const newTurret = new Turret(tile, intersect.face.normal);
            tile.turret = newTurret;
            addEntity(newTurret);
            turretCount += 1;
          }
        }
        selectedTile = undefined;
        selectFace.mesh.visible = false;
        clearHighlights();
      } else {
        const prevTile = selectedTile;
        selectedTile = board.faceToTile[intersect.faceIndex];

        // draw the selected tile highlight
        const linePosition = selectFace.mesh.geometry.attributes.position;

        linePosition.array[0] = tile.a.x;

        linePosition.copyAt(0, meshPosition, tile.a);
        linePosition.copyAt(1, meshPosition, tile.b);
        linePosition.copyAt(2, meshPosition, tile.c);
        linePosition.copyAt(3, meshPosition, tile.a);

        if (tile.turret && !tile.turret.moving) {
          // show adjacent tiles
          tile.adjacents.forEach((adjTile, adjInd) => {
            if (adjTile.turret === undefined) {
              adjTile.available = true;
              const v1 = new THREE.Vector3(
                meshPosition.getX(adjTile.a),
                meshPosition.getY(adjTile.a),
                meshPosition.getZ(adjTile.a)
              );
              const v2 = new THREE.Vector3(
                meshPosition.getX(adjTile.b),
                meshPosition.getY(adjTile.b),
                meshPosition.getZ(adjTile.b)
              );
              const v3 = new THREE.Vector3(
                meshPosition.getX(adjTile.c),
                meshPosition.getY(adjTile.c),
                meshPosition.getZ(adjTile.c)
              );
              const newGeometry = new THREE.BufferGeometry();
              const vertices = new Float32Array([
                v1.x,
                v1.y,
                v1.z,
                v2.x,
                v2.y,
                v2.z,
                v3.x,
                v3.y,
                v3.z,
              ]);
              newGeometry.setAttribute(
                "position",
                new THREE.BufferAttribute(vertices, 3)
              );
              const adjLine = new THREE.Mesh(
                newGeometry,
                new THREE.MeshBasicMaterial({ color: 0xfcec03 })
              );
              scene.add(adjLine);
              adjLines.push({ highlight: adjLine, tile: adjTile });
            }
          });
        } else {
          if (tile.available) {
            board.tiles[prevTile].turret.moveFromTo(
              board.tiles[prevTile],
              tile
            );
            clearHighlights();
          } else {
            clearHighlights();
          }
        }
        board.mesh.updateMatrix();
        selectFace.mesh.geometry.applyMatrix4(board.mesh.matrix);
        selectFace.mesh.visible = true;
      }
    } else {
      selectFace.mesh.visible = false;
      clearHighlights();
    }
  }
}

function onKeyDown(event) {
  if (stats.phase === "flight") {
    if (event.code === "Space") {
      fighter.breaking = true;
    }
    if (event.code === "Tab") {
      stats.phase = "build";
    }
  } else {
    if (event.code === "Tab") {
      stats.phase = "flight";
    }
  }
}

function onKeyUp(event) {
  if (stats.phase === "flight") {
    if (event.code === "Space") {
      fighter.breaking = false;
    }
  }
}

function clearHighlights() {
  adjLines.forEach((adjLine) => {
    adjLine.tile.available = false;
    scene.remove(adjLine.highlight);
  });
  adjLines = [];
}

function animate(timeMs) {
  if (stats.gameover) return;
  const time = timeMs * 0.0001;
  requestAnimationFrame(animate);

  if (stats.phase === "build") {
    cameraLight.position.copy(perspectiveCamera.position);
  } else if (stats.phase === "flight") {
    cameraLight.position.copy(
      fighter.group.localToWorld(fighter.group.position.clone())
    );
  }
  entities.forEach((obj) => {
    // skip the fighter if in build mode
    if ((stats.phase !== "flight") & (obj == fighter)) return;
    obj.timeStep(time);
  });

  // game logic
  if (stats.phase === "build") {
    fighter.breaking = true;
    fighter.crosshairs.sprite.visible = false;
  }
  const newTroop = checkNewEnemy(time, board.tiles);
  if (newTroop) {
    addEntity(newTroop);
    blobMeshes.push(newTroop.mesh);
  }
  handleCollisions(entities, scene, score, time, blobMeshes, idToEntity);
  document.getElementById("turrets-remaining").innerHTML =
    settings.MAX_TURRETS - turretCount;

  controls.update();

  render();
}

function addEntity(entity) {
  idToEntity.set(entity.mesh.id, entity);
  entities.push(entity);
  scene.add(entity.mesh);
}

function render() {
  if (stats.phase == "build") {
    const camera = perspectiveCamera;

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObject(board.mesh);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const tile = board.tiles[board.faceToTile[intersect.faceIndex]];
      const linePosition = selectLines.mesh.geometry.attributes.position;

      linePosition.copyAt(0, meshPosition, tile.a);
      linePosition.copyAt(1, meshPosition, tile.b);
      linePosition.copyAt(2, meshPosition, tile.c);
      linePosition.copyAt(3, meshPosition, tile.a);

      board.mesh.updateMatrix();

      selectLines.mesh.geometry.applyMatrix4(board.mesh.matrix);

      selectLines.mesh.visible = true;
    } else {
      selectLines.mesh.visible = false;
    }

    renderer.render(scene, camera);
  } else {
    fighter.camera.getWorldPosition(new THREE.Vector3()); // weird bug fix
    fighter.camera.updateProjectionMatrix();
    renderer.render(scene, fighter.camera);
  }
}
