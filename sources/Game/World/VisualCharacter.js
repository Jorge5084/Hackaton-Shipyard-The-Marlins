import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

export class VisualCharacter
{
    constructor(parent)
    {
        this.currentCharacter = 'main'

        this.characterConfigs = {
            main: {
                path: 'characters/main/personaje.glb',
                scale: 0.04,
                position: new THREE.Vector3(0, 1.3, 0),
            },
            robot: {
                path: 'characters/robot/personaje.glb',
                scale: 0.5,
                position: new THREE.Vector3(0, -0.2, 0),
            },
        }
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

    load(characterName = this.currentCharacter)
    {
        const config = this.characterConfigs[characterName]

        if(!config)
        {
            console.warn('Character config not found:', characterName)
            return
        }

        const resourceKey = `character_${characterName}_${Date.now()}`

        this.game.resourcesLoader.load([
            [resourceKey, config.path, 'gltf']
        ]).then((resources) =>
        {
            const gltf = resources[resourceKey]

            this.model = gltf.scene

            this.model.scale.set(config.scale, config.scale, config.scale)
            this.model.position.copy(config.position)

            this.model.traverse((child) =>
            {
                if(child.isMesh || child.isSkinnedMesh)
                {
                    child.castShadow = true
                    child.receiveShadow = true
                }
            })

            this.parent.add(this.model)

            console.log('VisualCharacter cargado:', characterName, this.model)

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

                if(this.animationNames.idle)
                    this.play(this.animationNames.idle)
                else
                    this.play(this.animationNames.fallback)

                console.log('Animaciones asignadas:', this.animationNames)
            }
            else
            {
                console.warn('El personaje no tiene animaciones.')
            }
        })
    }
    clearModel()
    {
        if(this.mixer)
        {
            this.mixer.stopAllAction()
            this.mixer = null
        }

        this.actions = {}

        this.animationNames = {
            idle: null,
            walk: null,
            run: null,
            jump: null,
            fallback: null,
        }

        this.currentAction = null
        this.currentAnimation = null

        if(this.model)
        {
            this.parent.remove(this.model)
            this.model = null
        }
    }

    setCharacter(characterName)
    {
        if(this.currentCharacter === characterName)
            return

        this.currentCharacter = characterName

        this.clearModel()
        this.load(characterName)
    }

    toggleCharacter()
    {
        const nextCharacter = this.currentCharacter === 'main' ? 'robot' : 'main'

        console.log('Cambiando personaje a:', nextCharacter)

        this.setCharacter(nextCharacter)
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