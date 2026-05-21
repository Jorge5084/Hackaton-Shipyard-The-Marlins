import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

export class VisualCharacter
{
    constructor(parent)
    {
        this.game = Game.getInstance()
        this.parent = parent

        this.model = null
        this.mixer = null
        this.actions = {}
        this.currentAction = null
        this.clock = new THREE.Clock()

        this.animationNames = {
            idle: null,
            walk: null,
            run: null,
            jump: null,
            fallback: null,
        }

        this.debugCounter = 0

        this.load()

        // El personaje se actualiza solo cada frame
        this.tickCallback = () =>
        {
            this.update()
        }

        this.game.ticker.events.on('tick', this.tickCallback, 9)
    }

    load()
    {
        this.game.resourcesLoader.load([
            ['character', 'characters/personaje.glb', 'gltf']
        ]).then((resources) =>
        {
            const gltf = resources.character

            this.model = gltf.scene

            this.model.scale.set(0.5, 0.5, 0.5)
            this.model.position.set(0, -0.2, 0)

            this.model.traverse((child) =>
            {
                if(child.isMesh || child.isSkinnedMesh)
                {
                    child.castShadow = true
                    child.receiveShadow = true
                }
            })

            this.parent.add(this.model)

            console.log('VisualCharacter cargado:', this.model)

            if(gltf.animations && gltf.animations.length > 0)
            {
                console.log(
                    'Animaciones encontradas:',
                    gltf.animations.map((animation) => animation.name)
                )

                this.mixer = new THREE.AnimationMixer(this.model)

                for(const animation of gltf.animations)
                {
                    const key = animation.name.toLowerCase()
                    const action = this.mixer.clipAction(animation)

                    action.reset()
                    action.setLoop(THREE.LoopRepeat, Infinity)
                    action.clampWhenFinished = false
                    action.enabled = true
                    action.paused = false
                    action.timeScale = 1

                    this.actions[key] = action
                }

                this.setAnimationNames(gltf.animations)

                // PRUEBA: movimientos
                if(this.animationNames.idle)
                    this.play(this.animationNames.idle)
                else
                    this.play(this.animationNames.fallback)

                console.log('Forzando animación:', this.animationNames.fallback)
            }
            else
            {
                console.warn('El personaje no tiene animaciones.')
            }
        })
    }

    setAnimationNames(animations)
    {
        const names = animations.map((animation) => animation.name.toLowerCase())

        this.animationNames.idle =
            names.find((name) => name.includes('idle')) ||
            names.find((name) => name.includes('standing')) ||
            null

        this.animationNames.walk =
            names.find((name) => name.includes('walking')) ||
            names.find((name) => name.includes('walk')) ||
            null

        this.animationNames.run =
            names.find((name) => name.includes('running')) ||
            names.find((name) => name.includes('run')) ||
            null

        this.animationNames.jump =
        names.find((name) => name.includes('jump')) ||
        null

        // Fallback, por si el modelo no tiene idle/walk/run/jump
        this.animationNames.fallback =
            names.find((name) => name.includes('dance')) ||
            names[0] ||
            null

        console.log('Animaciones asignadas:', this.animationNames)
    }

    play(name)
    {
        if(!this.mixer)
            return

        if(!name)
            return

        const key = name.toLowerCase()
        const action = this.actions[key]

        if(!action)
        {
            console.warn(`No existe la animación: ${name}`)
            return
        }

        if(this.currentAction === action)
            return

        if(this.currentAction)
            this.currentAction.fadeOut(0.2)

        action.reset()
        action.fadeIn(0.2)
        action.play()

        this.currentAction = action

        console.log('Reproduciendo:', key)
    }

    update()
    {
        if(!this.mixer)
            return

        const delta = this.clock.getDelta()
        this.mixer.update(delta)

        const physicalVehicle = this.game.physicalVehicle

        if(!physicalVehicle || !physicalVehicle.velocity)
            return

        const velocity = physicalVehicle.velocity

        const horizontalSpeed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.z * velocity.z
        )

        // Priority:
        // 1. Jump
        // 2. Run
        // 3. Walk
        // 4. Idle
        if(physicalVehicle.isJumping && this.animationNames.jump)
        {
            this.play(this.animationNames.jump)
        }
        else if(physicalVehicle.isRunning && this.animationNames.run)
        {
            this.play(this.animationNames.run)
        }
        else if(horizontalSpeed > 0.3 && this.animationNames.walk)
        {
            this.play(this.animationNames.walk)
        }
        else if(this.animationNames.idle)
        {
            this.play(this.animationNames.idle)
        }
        else if(this.animationNames.fallback)
        {
            this.play(this.animationNames.fallback)
        }
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this.tickCallback)
    }
}