// Generated from mcp-server/codeDeployer/boidsManager.ts by npm run build.
import * as THREE from 'three';
export function createBoidsAquariumManager(THREE) {
    return class BoidsAquariumManager {
        beforeStep = null;
        externalSteering = null;
        afterStep = null;
        scene;
        bounds;
        fishInstances = [];
        obstacles = [];
        maxSpeed;
        minSpeed;
        maxForce;
        neighborRadius;
        separationDist;
        avoidanceLookAhead;
        boundsMargin;
        turnRate;
        fixedDelta;
        maxSubSteps;
        maxFrameDelta;
        weights;
        stats = { subSteps: 0, neighborChecks: 0, obstacleChecks: 0, droppedTime: 0, fishCount: 0 };
        random;
        accumulator = 0;
        nextId = 1;
        disposed = false;
        grid = new Map();
        ray;
        point;
        box;
        constructor(scene, options = {}) {
            if (!scene?.isObject3D)
                throw new Error('Boids manager requires a scene/group');
            this.scene = scene;
            this.bounds = (options.bounds || new THREE.Box3(new THREE.Vector3(-4, .2, -3), new THREE.Vector3(4, 3.5, 3))).clone();
            if (this.bounds.isEmpty() || ['x', 'y', 'z'].some(a => this.bounds.min[a] >= this.bounds.max[a]) || ![...this.bounds.min.toArray(), ...this.bounds.max.toArray()].every(Number.isFinite))
                throw new Error('Aquarium bounds must be finite and nonempty');
            const number = (name, fallback, zero = false) => { const v = options[name] ?? fallback; if (typeof v !== 'number' || !Number.isFinite(v) || (zero ? v < 0 : v <= 0))
                throw new Error(`Invalid ${name}`); return v; };
            this.maxSpeed = number('maxSpeed', 1.8);
            this.minSpeed = number('minSpeed', .35, true);
            this.maxForce = number('maxForce', 1.8);
            this.neighborRadius = number('neighborRadius', 1.5);
            this.separationDist = number('separationDist', .6);
            this.avoidanceLookAhead = number('avoidanceLookAhead', 1.2);
            this.boundsMargin = number('boundsMargin', .8);
            this.turnRate = number('turnRate', 5);
            this.fixedDelta = number('fixedDelta', 1 / 60);
            this.maxSubSteps = number('maxSubSteps', 12);
            this.maxFrameDelta = number('maxFrameDelta', .2);
            if (!Number.isInteger(this.maxSubSteps) || this.minSpeed > this.maxSpeed)
                throw new Error('maxSubSteps must be an integer; minSpeed cannot exceed maxSpeed');
            this.weights = { separation: 1.8, alignment: 1, cohesion: 1, avoidance: 3.5, bounds: 2, ...options.weights };
            for (const value of Object.values(this.weights))
                if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
                    throw new Error('Boids weights must be finite and nonnegative');
            if (options.seed !== undefined && !Number.isSafeInteger(options.seed))
                throw new Error('seed must be a safe integer');
            let seed = (options.seed ?? 12345) >>> 0;
            this.random = options.random || (() => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
            if (typeof this.random !== 'function')
                throw new Error('random must be a function');
            this.ray = new THREE.Ray();
            this.point = new THREE.Vector3();
            this.box = new THREE.Box3();
        }
        live() { if (this.disposed)
            throw new Error('Boids manager is disposed'); }
        rand() { const value = this.random(); if (!Number.isFinite(value) || value < 0 || value >= 1)
            throw new Error('random() must return [0,1)'); return value; }
        attached(object) { let node = object; while (node) {
            if (node === this.scene)
                return true;
            node = node.parent;
        } return false; }
        /** Static obstacle AABB cached once; use dynamic:true or refreshObstacle after movement. */
        addObstacle(object, options = {}) {
            this.live();
            if (!object?.isObject3D && !object?.isBox3)
                throw new Error('Obstacle must be an Object3D/group or world Box3');
            if (this.obstacles.some(o => o.object === object))
                throw new Error('Obstacle already registered');
            const padding = options.padding ?? 0;
            if (!Number.isFinite(padding) || padding < 0)
                throw new Error('Invalid obstacle padding');
            const obstacle = { object, box: new THREE.Box3(), padding, dynamic: !!options.dynamic };
            this.refreshObstacleRecord(obstacle);
            this.obstacles.push(obstacle);
            return obstacle;
        }
        refreshObstacleRecord(obstacle) {
            if (obstacle.object.isBox3)
                obstacle.box.copy(obstacle.object);
            else {
                obstacle.object.updateWorldMatrix(true, true);
                obstacle.box.setFromObject(obstacle.object);
            }
            if (obstacle.box.isEmpty() || ![...obstacle.box.min.toArray(), ...obstacle.box.max.toArray()].every(Number.isFinite))
                throw new Error('Obstacle has no finite measurable bounds');
        }
        refreshObstacle(objectOrRecord) { this.live(); const o = this.obstacles.find(o => o === objectOrRecord || o.object === objectOrRecord); if (!o)
            throw new Error('Obstacle not registered'); this.refreshObstacleRecord(o); }
        removeObstacle(objectOrRecord) { const index = this.obstacles.findIndex(o => o === objectOrRecord || o.object === objectOrRecord); if (index < 0)
            return false; this.obstacles.splice(index, 1); return true; }
        /** Preserve spawn unless randomizePosition:true. Forward sign points toward HEAD, not tail. */
        addFish(mesh, bioController = null, options = {}) {
            this.live();
            if (!mesh?.isObject3D || !this.attached(mesh))
                throw new Error('Fish must be attached beneath the managed scene/group');
            if (this.fishInstances.some(f => f.mesh === mesh))
                throw new Error('Fish already registered');
            // A rotated nonuniform ancestor creates shear: no quaternion-only heading can undo it.
            for (let p = mesh.parent; p; p = p.parent)
                if (p.scale.x <= 0 || Math.abs(p.scale.x - p.scale.y) > 1e-7 || Math.abs(p.scale.x - p.scale.z) > 1e-7)
                    throw new Error('Fish ancestors require positive uniform scale for world heading');
            mesh.updateWorldMatrix(true, true);
            const position = mesh.getWorldPosition(new THREE.Vector3());
            if (!position.toArray().every(Number.isFinite) || mesh.scale.toArray().some((v) => !Number.isFinite(v) || v <= 0))
                throw new Error('Fish transform must be finite with positive scale');
            const deformationMargin = options.deformationMargin ?? .05;
            if (!Number.isFinite(deformationMargin) || deformationMargin < 0)
                throw new Error('Invalid deformationMargin');
            let radius = options.radius;
            if (radius === undefined) {
                const bounds = new THREE.Box3().setFromObject(mesh);
                if (bounds.isEmpty())
                    throw new Error('Fish needs measurable geometry or explicit radius');
                radius = 0;
                for (let i = 0; i < 8; i++) {
                    const corner = new THREE.Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z);
                    radius = Math.max(radius, corner.distanceTo(position));
                }
                radius += deformationMargin;
            }
            if (!Number.isFinite(radius) || radius <= 0)
                throw new Error('Fish radius must be finite and positive');
            const inner = this.bounds.clone().expandByScalar(-radius);
            if (inner.isEmpty() || inner.min.x >= inner.max.x || inner.min.y >= inner.max.y || inner.min.z >= inner.max.z)
                throw new Error('Fish radius cannot fit aquarium bounds');
            const axis = options.forwardAxis ?? bioController?.uniforms?.uSpineAxis?.value ?? 2;
            const sign = options.forwardSign ?? (bioController?.uniforms?.uSpineDir ? -bioController.uniforms.uSpineDir.value : 1);
            if (![0, 2].includes(axis) || ![-1, 1].includes(sign))
                throw new Error('forwardAxis must be 0/2 and forwardSign must be -1/1');
            const localForward = new THREE.Vector3(axis === 0 ? sign : 0, 0, axis === 2 ? sign : 0);
            const multiplier = options.speedMultiplier ?? (.8 + this.rand() * .4);
            if (!Number.isFinite(multiplier) || multiplier <= 0 || this.maxSpeed * multiplier < this.minSpeed)
                throw new Error('Invalid speedMultiplier');
            const velocity = options.velocity?.clone() || new THREE.Vector3(this.rand() - .5, (this.rand() - .5) * .2, this.rand() - .5);
            if (!velocity.isVector3 || !velocity.toArray().every(Number.isFinite))
                throw new Error('Invalid velocity');
            if (velocity.lengthSq() < 1e-12)
                velocity.copy(localForward);
            if (!options.velocity)
                velocity.normalize().multiplyScalar(this.maxSpeed * multiplier * .7);
            velocity.clampLength(this.minSpeed, this.maxSpeed * multiplier);
            const record = { blocked: false, id: this.nextId++, mesh, bioController, position, velocity, acceleration: new THREE.Vector3(), radius, speedMultiplier: multiplier,
                separation: new THREE.Vector3(), alignment: new THREE.Vector3(), cohesion: new THREE.Vector3(), avoidance: new THREE.Vector3(), boundsForce: new THREE.Vector3(),
                correction: new THREE.Quaternion().setFromUnitVectors(localForward, new THREE.Vector3(0, 0, 1)), horizontalOnly: options.horizontalOnly !== false, inner };
            if (options.randomizePosition) {
                let found = false;
                for (let attempt = 0; attempt < 64; attempt++) {
                    for (const a of ['x', 'y', 'z'])
                        position[a] = inner.min[a] + this.rand() * (inner.max[a] - inner.min[a]);
                    if (!this.obstacles.some(o => o.box.clone().expandByScalar(radius + o.padding).containsPoint(position))) {
                        found = true;
                        break;
                    }
                }
                if (!found)
                    throw new Error('No free random spawn found; reduce radius/obstacles or supply a clear position');
            }
            else if (!inner.containsPoint(position))
                throw new Error('Spawn is outside radius-inset bounds; move fish or use randomizePosition:true');
            this.fishInstances.push(record);
            this.writeTransform(record, 0);
            return record;
        }
        removeFish(meshOrRecord) { const index = this.fishInstances.findIndex(f => f === meshOrRecord || f.mesh === meshOrRecord); if (index < 0)
            return false; this.fishInstances.splice(index, 1); return true; }
        key(x, y, z) { return `${x},${y},${z}`; }
        hash() {
            this.grid.clear();
            const cell = Math.max(this.neighborRadius, this.separationDist);
            for (const fish of this.fishInstances) {
                const key = this.key(Math.floor(fish.position.x / cell), Math.floor(fish.position.y / cell), Math.floor(fish.position.z / cell));
                let bucket = this.grid.get(key);
                if (!bucket) {
                    bucket = [];
                    this.grid.set(key, bucket);
                }
                bucket.push(fish);
            }
        }
        steer(direction, fish, limit = this.maxForce) {
            if (direction.lengthSq() < 1e-16)
                return direction.set(0, 0, 0);
            return direction.normalize().multiplyScalar(this.maxSpeed * fish.speedMultiplier).sub(fish.velocity).clampLength(0, limit);
        }
        seek(fish, target) { return this.steer(new THREE.Vector3().subVectors(target, fish.position), fish); }
        flock(fish) {
            const separation = fish.separation.set(0, 0, 0), alignment = fish.alignment.set(0, 0, 0), cohesion = fish.cohesion.set(0, 0, 0);
            let near = 0, close = 0;
            const cell = Math.max(this.neighborRadius, this.separationDist);
            const x = Math.floor(fish.position.x / cell), y = Math.floor(fish.position.y / cell), z = Math.floor(fish.position.z / cell);
            const diff = new THREE.Vector3();
            for (let dx = -1; dx <= 1; dx++)
                for (let dy = -1; dy <= 1; dy++)
                    for (let dz = -1; dz <= 1; dz++) {
                        for (const other of this.grid.get(this.key(x + dx, y + dy, z + dz)) || []) {
                            if (other === fish)
                                continue;
                            this.stats.neighborChecks++;
                            diff.subVectors(fish.position, other.position);
                            const d2 = diff.lengthSq();
                            if (d2 < this.neighborRadius * this.neighborRadius) {
                                alignment.add(other.velocity);
                                cohesion.add(other.position);
                                near++;
                            }
                            if (d2 < this.separationDist * this.separationDist) {
                                if (d2 < 1e-12) {
                                    const low = Math.min(fish.id, other.id), high = Math.max(fish.id, other.id), angle = (low * 12.9898 + high * 78.233);
                                    const s = fish.id < other.id ? 1 : -1;
                                    diff.set(Math.cos(angle) * s, 0, Math.sin(angle) * s);
                                }
                                else
                                    diff.divideScalar(d2);
                                separation.add(diff);
                                close++;
                            }
                        }
                    }
            if (close)
                this.steer(separation.divideScalar(close), fish);
            if (near) {
                this.steer(alignment.divideScalar(near), fish);
                this.steer(cohesion.divideScalar(near).sub(fish.position), fish);
            }
        }
        computeBoundsForce(fish) {
            const result = fish.boundsForce.set(0, 0, 0), pos = fish.position, inner = fish.inner;
            for (const a of ['x', 'y', 'z']) {
                const margin = Math.min(this.boundsMargin, (inner.max[a] - inner.min[a]) * .45);
                if (pos[a] < inner.min[a] + margin)
                    result[a] += (inner.min[a] + margin - pos[a]) / margin;
                if (pos[a] > inner.max[a] - margin)
                    result[a] -= (pos[a] - inner.max[a] + margin) / margin;
            }
            return this.steer(result, fish, this.maxForce * 2);
        }
        /** Look-ahead ray against inflated WORLD AABBs. No allocation or mesh triangle traversal per obstacle. */
        computeObstacleAvoidance(fish) {
            const result = fish.avoidance.set(0, 0, 0);
            if (fish.velocity.lengthSq() < 1e-12)
                return result;
            this.ray.origin.copy(fish.position);
            this.ray.direction.copy(fish.velocity).normalize();
            let nearest = this.avoidanceLookAhead;
            let hit = null;
            for (const obstacle of this.obstacles) {
                this.stats.obstacleChecks++;
                this.box.copy(obstacle.box).expandByScalar(fish.radius + obstacle.padding);
                if (this.box.containsPoint(fish.position)) {
                    hit = obstacle;
                    nearest = 0;
                    break;
                }
                if (this.box.distanceToPoint(fish.position) > nearest)
                    continue;
                if (this.ray.intersectBox(this.box, this.point)) {
                    const distance = this.point.distanceTo(fish.position);
                    if (distance <= nearest) {
                        nearest = distance;
                        hit = obstacle;
                    }
                }
            }
            if (hit) {
                hit.box.getCenter(result);
                result.subVectors(fish.position, result);
                result.y *= .3;
                // Head-on symmetry needs a side component to turn, not merely brake to zero.
                const side = new THREE.Vector3(-this.ray.direction.z, 0, this.ray.direction.x);
                if (side.lengthSq() < 1e-8)
                    side.set(1, 0, 0);
                side.normalize();
                const dot = result.dot(side);
                if (dot < 0 || (Math.abs(dot) < 1e-8 && fish.id % 2 === 0))
                    side.negate();
                result.normalize().addScaledVector(side, 1.5);
                this.steer(result, fish, this.maxForce * 2.5);
            }
            return result;
        }
        nearestFace(point, box) {
            let distance = Infinity, axis = 'x', sign = -1;
            for (const a of ['x', 'y', 'z'])
                for (const s of [-1, 1]) {
                    const d = Math.abs(point[a] - (s < 0 ? box.min[a] : box.max[a]));
                    if (d < distance) {
                        distance = d;
                        axis = a;
                        sign = s;
                    }
                }
            return { axis, sign };
        }
        constrain(fish) {
            for (const a of ['x', 'y', 'z']) {
                if (fish.position[a] < fish.inner.min[a]) {
                    fish.position[a] = fish.inner.min[a];
                    fish.velocity[a] = Math.abs(fish.velocity[a]);
                }
                if (fish.position[a] > fish.inner.max[a]) {
                    fish.position[a] = fish.inner.max[a];
                    fish.velocity[a] = -Math.abs(fish.velocity[a]);
                }
            }
        }
        move(fish, dt) {
            this.constrain(fish);
            // Resolve a newly enclosed spawn/dynamic obstacle first. Bounded iterative solver, not a rigid-body engine.
            for (let pass = 0; pass < 8; pass++) {
                let changed = false;
                for (const obstacle of this.obstacles) {
                    this.box.copy(obstacle.box).expandByScalar(fish.radius + obstacle.padding);
                    if (this.box.containsPoint(fish.position)) {
                        const face = this.nearestFace(fish.position, this.box);
                        fish.position[face.axis] = (face.sign < 0 ? this.box.min[face.axis] : this.box.max[face.axis]) + face.sign * 1e-5;
                        if (fish.velocity[face.axis] * face.sign < 0)
                            fish.velocity[face.axis] = 0;
                        changed = true;
                    }
                }
                this.constrain(fish);
                if (!changed)
                    break;
            }
            fish.blocked = this.obstacles.some(o => o.box.clone().expandByScalar(fish.radius + o.padding).containsPoint(fish.position));
            if (fish.blocked) {
                fish.velocity.set(0, 0, 0);
                return;
            }
            const distance = fish.velocity.length() * dt;
            if (distance > 1e-12) {
                this.ray.origin.copy(fish.position);
                this.ray.direction.copy(fish.velocity).normalize();
                let travel = distance;
                let normal = null;
                for (const obstacle of this.obstacles) {
                    this.stats.obstacleChecks++;
                    this.box.copy(obstacle.box).expandByScalar(fish.radius + obstacle.padding);
                    if (this.box.containsPoint(fish.position))
                        continue;
                    if (this.ray.intersectBox(this.box, this.point)) {
                        const d = this.point.distanceTo(fish.position);
                        if (d <= travel) {
                            travel = Math.max(0, d - 1e-5);
                            normal = this.nearestFace(this.point, this.box);
                        }
                    }
                }
                fish.position.addScaledVector(this.ray.direction, travel);
                if (normal && fish.velocity[normal.axis] * normal.sign < 0)
                    fish.velocity[normal.axis] = 0;
            }
            this.constrain(fish);
        }
        writeTransform(fish, dt) {
            const parent = fish.mesh.parent;
            if (!parent)
                return;
            parent.updateWorldMatrix(true, false);
            fish.mesh.position.copy(parent.worldToLocal(fish.position.clone()));
            const direction = fish.velocity.clone();
            if (fish.horizontalOnly)
                direction.y = 0;
            if (direction.lengthSq() > 1e-12 && dt > 0) {
                direction.normalize();
                const look = new THREE.Matrix4().lookAt(direction, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
                const target = new THREE.Quaternion().setFromRotationMatrix(look).multiply(fish.correction);
                const parentRotation = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
                target.premultiply(parentRotation);
                fish.mesh.quaternion.slerp(target, 1 - Math.exp(-this.turnRate * dt));
            }
            fish.mesh.updateMatrixWorld(true);
        }
        step() {
            this.beforeStep?.(this.fixedDelta);
            // Snapshot all positions/velocities before computing any force: no in-loop neighbor update bias.
            for (const fish of this.fishInstances)
                fish.mesh.getWorldPosition(fish.position);
            this.hash();
            for (const fish of this.fishInstances) {
                this.flock(fish);
                this.computeObstacleAvoidance(fish);
                this.computeBoundsForce(fish);
                fish.acceleration.set(0, 0, 0).addScaledVector(fish.separation, this.weights.separation).addScaledVector(fish.alignment, this.weights.alignment).addScaledVector(fish.cohesion, this.weights.cohesion).addScaledVector(fish.avoidance, this.weights.avoidance).addScaledVector(fish.boundsForce, this.weights.bounds);
                fish.motionSpeedBoost = 1;
                this.externalSteering?.(fish, this.fixedDelta);
                if (!Number.isFinite(fish.motionSpeedBoost) || fish.motionSpeedBoost < 1 || fish.motionSpeedBoost > 3)
                    throw new Error('Steering speed boost must be 1..3');
            }
            for (const fish of this.fishInstances) {
                fish.velocity.addScaledVector(fish.acceleration, this.fixedDelta);
                if (fish.velocity.lengthSq() < 1e-14 && this.minSpeed > 0)
                    fish.velocity.set(this.minSpeed, 0, 0);
                fish.velocity.clampLength(this.minSpeed, this.maxSpeed * fish.speedMultiplier * fish.motionSpeedBoost);
                this.move(fish, this.fixedDelta);
                this.writeTransform(fish, this.fixedDelta);
            }
            this.afterStep?.(this.fixedDelta);
        }
        /** Locomotion only. The deployer's single update loop owns mixer/Bio-Motion time. */
        update(delta) {
            this.live();
            if (!Number.isFinite(delta) || delta < 0)
                throw new Error('delta must be finite and nonnegative seconds');
            this.stats.subSteps = 0;
            this.stats.neighborChecks = 0;
            this.stats.obstacleChecks = 0;
            for (let i = this.fishInstances.length - 1; i >= 0; i--)
                if (!this.attached(this.fishInstances[i].mesh))
                    this.fishInstances.splice(i, 1);
            this.stats.fishCount = this.fishInstances.length;
            for (const obstacle of this.obstacles)
                if (obstacle.dynamic)
                    this.refreshObstacleRecord(obstacle);
            const accepted = Math.min(delta, this.maxFrameDelta);
            this.stats.droppedTime += delta - accepted;
            this.accumulator += accepted;
            while (this.accumulator + 1e-10 >= this.fixedDelta && this.stats.subSteps < this.maxSubSteps) {
                this.step();
                this.accumulator = Math.max(0, this.accumulator - this.fixedDelta);
                this.stats.subSteps++;
            }
            if (this.accumulator >= this.fixedDelta) {
                const retained = this.accumulator % this.fixedDelta;
                this.stats.droppedTime += this.accumulator - retained;
                this.accumulator = retained;
            }
            this.stats.blockedFish = this.fishInstances.filter(f => f.blocked).length;
            return this.stats;
        }
        clear() { this.fishInstances.length = 0; this.obstacles.length = 0; this.grid.clear(); this.accumulator = 0; this.stats.fishCount = 0; this.stats.blockedFish = 0; this.stats.subSteps = 0; this.stats.neighborChecks = 0; this.stats.obstacleChecks = 0; }
        dispose() { if (this.disposed)
            return; this.clear(); this.beforeStep = null; this.afterStep = null; this.externalSteering = null; this.disposed = true; }
    };
}
export const BoidsAquariumManager = createBoidsAquariumManager(THREE);
