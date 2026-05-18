import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

export class PhysicsCharacter
{
    constructor()
    {
        this.game = Game.getInstance()

        // Compatibilidad con el sistema viejo de physicalVehicle
        this.position = new THREE.Vector3()
        this.velocity = new THREE.Vector3()
        this.forward = new THREE.Vector3(1, 0, 0)
        this.quaternion = new THREE.Quaternion()

        this.rotationY = 0
        this.speed = 0
        this.xzSpeed = 0
        this.forwardSpeed = 0
        this.steeringAmplitude = 0
        this.goingForward = false
        this.introLockedPosition = new THREE.Vector3(0, 3, 0)
        // Compatibility with old vehicle systems
        this.wheels = {
            inContactCount: 1,
            justTouchedCount: 0,
            justTouchedFloor: false,

            settings: {
                radius: 0.35,
            },

            items: [],
        }

        this.walkSpeed = 5

        this.character = this.game.objects.add(null, {
            type: 'dynamic',
            position: new THREE.Vector3(0, 3, 0),
            friction: 0.8,
            colliders: [
                {
                    shape: 'cylinder',
                    parameters: [0.9, 0.35],
                    position: { x: 0, y: 0.9, z: 0 },
                    mass: 1,
                },
            ],
            canSleep: false,
            waterGravityMultiplier: 0,
        })
        this.chassis = this.character
        this.body = this.character.physical.body
        // Prevent the character collider from rolling or tilting
        if(this.body.setEnabledRotations)
        {
            this.body.setEnabledRotations(false, false, false, true)
        }

        this.prePhysicsCallback = () =>
        {
            this.updatePrePhysics()
        }

        this.postPhysicsCallback = () =>
        {
            this.updatePostPhysics()
        }

        this.game.ticker.events.on('tick', this.prePhysicsCallback, 2)
        this.game.ticker.events.on('tick', this.postPhysicsCallback, 5)
    }

    updatePrePhysics()
    {
        const currentVelocity = this.body.linvel()

        const introActive = this.game.reveal && this.game.reveal.step < 2

        if(introActive)
        {
            this.body.setTranslation(this.introLockedPosition, true)
            this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)

            this.position.copy(this.introLockedPosition)
            this.velocity.set(0, 0, 0)
            this.speed = 0
            this.xzSpeed = 0
            this.forwardSpeed = 0
            this.goingForward = false

            return
        }

        let inputX =
            (this.game.inputs.actions.get('right')?.active ? 1 : 0) +
            (this.game.inputs.actions.get('left')?.active ? -1 : 0)

        let inputZ =
            (this.game.inputs.actions.get('forward')?.active ? 1 : 0) +
            (this.game.inputs.actions.get('backward')?.active ? -1 : 0)
        // Gamepad left joystick
        if(this.game.inputs.gamepad?.joysticks?.left?.active)
        {
            inputX = this.game.inputs.gamepad.joysticks.left.safeX
            inputZ = -this.game.inputs.gamepad.joysticks.left.safeY
        }
        // Mobile joystick / nipple
        if(this.game.inputs.nipple?.active && this.game.inputs.nipple.progress > 0)
        {
            const angle = this.game.inputs.nipple.angle
            const strength = this.game.inputs.nipple.progress

            inputX = Math.cos(angle) * strength
            inputZ = Math.sin(angle) * strength
        }

        const hasMovementInput = inputX !== 0 || inputZ !== 0

        if(!hasMovementInput)
        {
            this.body.setLinvel({
                x: 0,
                y: currentVelocity.y,
                z: 0,
            }, true)

            this.goingForward = false
            return
        }

        // Camera-based movement
        const camera = this.game.view.camera

        const cameraForward = new THREE.Vector3()
        camera.getWorldDirection(cameraForward)

        cameraForward.y = 0
        cameraForward.normalize()

        const cameraRight = new THREE.Vector3()
        cameraRight.crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))
        cameraRight.normalize()

        const direction = new THREE.Vector3()

        direction.addScaledVector(cameraForward, inputZ)
        direction.addScaledVector(cameraRight, inputX)
        direction.normalize()

        // Character looks toward movement direction
        this.rotationY = Math.atan2(direction.x, direction.z)

        this.forward.set(
            Math.sin(this.rotationY),
            0,
            Math.cos(this.rotationY)
        )

        this.quaternion.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            this.rotationY
        )

        this.body.setLinvel({
            x: direction.x * this.walkSpeed,
            y: currentVelocity.y,
            z: direction.z * this.walkSpeed,
        }, true)

        this.goingForward = true
    }

    updatePostPhysics()
    {
        const introActive = this.game.reveal && this.game.reveal.step < 2

        if(introActive)
        {
            this.body.setTranslation(this.introLockedPosition, true)
            this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)

            this.position.copy(this.introLockedPosition)
            this.velocity.set(0, 0, 0)
            this.speed = 0
            this.xzSpeed = 0
            this.forwardSpeed = 0
            this.goingForward = false

            return
        }

        const translation = this.body.translation()
        const velocity = this.body.linvel()

        this.position.set(translation.x, translation.y, translation.z)
        this.velocity.set(velocity.x, velocity.y, velocity.z)

        this.xzSpeed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.z * velocity.z
        )

        this.speed = this.xzSpeed
        this.forwardSpeed = this.xzSpeed

        this.wheels.inContactCount = this.position.y <= 3.05 ? 1 : 0
        this.wheels.justTouchedCount = 0
        this.wheels.justTouchedFloor = false
    }

    moveTo(position)
    {
        this.body.setTranslation(position, true)
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)

        this.position.copy(position)
        this.velocity.set(0, 0, 0)
        this.speed = 0
        this.xzSpeed = 0
        this.forwardSpeed = 0

        this.introLockedPosition.copy(position)
        // ajuste en el numero 4 para que no se eleve
        this.introLockedPosition.y -= 4
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this.prePhysicsCallback)
        this.game.ticker.events.off('tick', this.postPhysicsCallback)
    }
}