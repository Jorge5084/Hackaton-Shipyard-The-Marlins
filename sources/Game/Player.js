import { Game } from './Game.js'
import gsap from 'gsap'
import { remapClamp, smallestAngle } from './utilities/maths.js'
import * as THREE from 'three/webgpu'
import { Inputs } from './Inputs/Inputs.js'
import { clamp } from 'three/src/math/MathUtils.js'

export class Player
{
    static STATE_DEFAULT = 1
    static STATE_LOCKED = 2

    constructor()
    {
        this.game = Game.getInstance()
        
        this.game.player = this
        
        this.state = Player.STATE_DEFAULT
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0
        this.suspensions = ['low', 'low', 'low', 'low']

        const respawn = this.game.respawns.getDefault()

        this.position = respawn.position.clone()
        this.basePosition = this.position.clone()
        this.position2 = new THREE.Vector2(this.position.x, this.position.z)
        this.rotationY = 0

        this.setSounds()
        this.setInputs()
        this.setDistanceDriven()
        this.setUnstuck()
        // this.setBackWheel()
        this.setFlip()
        this.setTimePlayed()

        this.game.physicalVehicle.chassis.physical.initialState.position.x = respawn.position.x
        this.game.physicalVehicle.chassis.physical.initialState.position.y = respawn.position.y
        this.game.physicalVehicle.chassis.physical.initialState.position.z = respawn.position.z
        this.game.physicalVehicle.moveTo(respawn.position, respawn.rotation)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 1)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 6)
    }

    setSounds()
    {
        this.sounds = {}

        // Character mode:
        // Vehicle sounds disabled.
        // Later we can add footsteps, jump sounds, landing sounds, etc.

        this.sounds.suspensions = {
            play: () => {}
        }

        this.sounds.spring1 = {
            play: () => {}
        }

        this.sounds.spring2 = {
            lay: () => {}
        }
    }

    setInputs()
    {
        this.game.inputs.addActions([
            { name: 'forward',               categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowUp', 'Keyboard.KeyW', 'Gamepad.up', 'Gamepad.r2' ] },
            { name: 'right',                 categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowRight', 'Keyboard.KeyD', 'Gamepad.right' ] },
            { name: 'backward',              categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowDown', 'Keyboard.KeyS', 'Gamepad.down', 'Gamepad.l2' ] },
            { name: 'left',                  categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowLeft', 'Keyboard.KeyA', 'Gamepad.left' ] },
            { name: 'boost',                 categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.ShiftLeft', 'Keyboard.ShiftRight', 'Gamepad.circle' ] },
            { name: 'brake',                 categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.KeyB', 'Keyboard.ControlLeft', 'Gamepad.square' ] },
            { name: 'respawn',               categories: [ 'wandering',                       ], keys: [ 'Keyboard.KeyR', 'Gamepad.select' ] },
            { name: 'suspensions',           categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad5', 'Keyboard.Space', 'Gamepad.triangle' ] },
            { name: 'suspensionsFront',      categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad8' ] },
            { name: 'suspensionsBack',       categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad2' ] },
            { name: 'suspensionsRight',      categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad6', 'Gamepad.r1' ] },
            { name: 'suspensionsLeft',       categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad4', 'Gamepad.l1' ] },
            { name: 'suspensionsFrontLeft',  categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad7', 'Keyboard.Digit2' ] },
            { name: 'suspensionsFrontRight', categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad9', 'Keyboard.Digit3' ] },
            { name: 'suspensionsBackRight',  categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad3', 'Keyboard.Digit4' ] },
            { name: 'suspensionsBackLeft',   categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad1', 'Keyboard.Digit1' ] },
            { name: 'interact',              categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.Enter', 'Keyboard.KeyE', 'Keyboard.KeyF', 'Gamepad.cross' ] },
            { name: 'honk',                  categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.KeyH', 'Gamepad.l3' ] },
        ])

        // Respawn
        this.game.inputs.events.on('respawn', (action) =>
        {
            if(this.state !== Player.STATE_DEFAULT)
                return

            if(action.active)
            {
                this.respawn()
            }
        })

        // Honk
        this.game.inputs.events.on('honk', (action) =>
        {
            if(action.active)
                this.honk()
        })

        // Suspensions
        const suspensionsUpdate = () =>
        {
            if(this.state !== Player.STATE_DEFAULT)
                return

            const activeSuspensions = [
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsFront').active || this.game.inputs.actions.get('suspensionsRight').active || this.game.inputs.actions.get('suspensionsFrontRight').active, // front right
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsFront').active || this.game.inputs.actions.get('suspensionsLeft').active || this.game.inputs.actions.get('suspensionsFrontLeft').active, // front left
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsBack').active || this.game.inputs.actions.get('suspensionsRight').active || this.game.inputs.actions.get('suspensionsBackRight').active, // back right
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsBack').active || this.game.inputs.actions.get('suspensionsLeft').active || this.game.inputs.actions.get('suspensionsBackLeft').active, // back left
            ]

            const activeState = this.game.inputs.actions.get('suspensions').active ? 'high' : 'mid' // high = jump, mid = lowride

            for(let i = 0; i < 4; i++)
                this.suspensions[i] = activeSuspensions[i] ? activeState : 'low'

            const activeCount = activeSuspensions[0] + activeSuspensions[1] + activeSuspensions[2] + activeSuspensions[3]
            

            if(activeCount)
            {
                // Sound
                this.sounds.suspensions.play(activeCount)

                // Not a jump => Achievement
                if(!this.game.inputs.actions.get('suspensions').active)
                    this.game.achievements.addProgress('suspensions')
            }
                
        }

        this.game.inputs.events.on('suspensions', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFront', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBack', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsLeft', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFrontLeft', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFrontRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBackRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBackLeft', suspensionsUpdate)

        this.game.inputs.events.on('suspensions', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                this.game.inputs.nipple.jump()
        })

        // Nipple tap jump
        let nippleJumpTimeout = null
        this.game.inputs.nipple.events.on('tap', () =>
        {
            this.game.inputs.nipple.jump()

            for(let i = 0; i < 4; i++)
                this.suspensions[i] = 'high'

            if(nippleJumpTimeout)
                clearTimeout(nippleJumpTimeout)
            
            nippleJumpTimeout = setTimeout(() =>
            {
                for(let i = 0; i < 4; i++)
                    this.suspensions[i] = 'low'
            }, 200)
        })
    }

    setDistanceDriven()
    {
        this.distanceDriven = {}

        const localDistanceDriven = localStorage.getItem('distanceDriven')
        this.distanceDriven.value = localDistanceDriven ? parseInt(localDistanceDriven) : 0
        this.distanceDriven.floored = Math.floor(this.distanceDriven.value)
        this.distanceDriven.reset = () =>
        {
            localStorage.removeItem('distanceDriven')
            this.distanceDriven.value = 0
            this.distanceDriven.floored = 0
        }
        
    }

    setUnstuck()
    {
        this.unstuck = {}
        this.unstuck.duration = 3
        this.unstuck.delay = null

        // Character mode / PhysicsCharacter compatibility:
        // If the current physical player has no vehicle events,
        // skip car-specific upside-down / stuck logic.
        if(!this.game.physicalVehicle.events)
        {
            this.game.inputs.interactiveButtons.events.on('unstuck', () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['unstuck'])
                this.respawn()
            })

            return
        }

        this.game.physicalVehicle.events.on('rightSideUp', () =>
        {
            // Reset delay
            if(this.unstuck.delay)
                this.unstuck.delay.kill()
        })

        const waitAndTest = () =>
        {
            this.unstuck.delay = gsap.delayedCall(this.unstuck.duration, () =>
            {
                this.unstuck.delay = null

                if(this.state !== Player.STATE_DEFAULT)
                    return

                // Still upside down => Flip back
                if(this.game.physicalVehicle.upsideDown.active)
                {
                    this.game.physicalVehicle.flip.jump()
                
                    // Sound
                    this.sounds.suspensions.play(4)

                    // Achievement
                    if(this.game.physicalVehicle.upsideDown.ratio > 0.75)
                        this.game.achievements.setProgress('upsideDown', 1)

                    // Again in case it didn't work
                    waitAndTest()
                }
            })
        }

        this.game.physicalVehicle.events.on('upsideDown', (ratio) =>
        {
            // Reset delay
            if(this.unstuck.delay)
                this.unstuck.delay.kill()

            // Wait a moment
            waitAndTest()
        })

        this.game.physicalVehicle.events.on('stuck', () =>
        {
            this.game.inputs.interactiveButtons.addItems(['unstuck'])
        })

        this.game.physicalVehicle.events.on('unstuck', () =>
        {
            this.game.inputs.interactiveButtons.removeItems(['unstuck'])
        })

        this.game.inputs.interactiveButtons.events.on('unstuck', () =>
        {
            this.game.inputs.interactiveButtons.removeItems(['unstuck'])
            this.respawn()
        })
    }

    // setBackWheel()
    // {
    //     let delay = null
    //     let startTime = null

    //     this.game.physicalVehicle.events.on('backWheel', (_active) =>
    //     {
    //         if(_active)
    //         {
    //             startTime = this.game.ticker.elapsed

    //             if(delay)
    //             {
    //                 delay.kill()
    //                 delay = null
    //             }
    //         }
    //         else
    //         {
    //             delay = gsap.delayedCall(0.1, () =>
    //             {
    //                 delay = null

    //                 const duration = this.game.ticker.elapsed - startTime

    //                 if(duration > 5)
    //                     this.game.achievements.setProgress('backWheel', 1)
    //             })
    //         }
    //     })
    // }

    setFlip()
    {
        // Character mode: PhysicsCharacter has no vehicle flip events
        if(!this.game.physicalVehicle.events)
        {
            return
        }

        this.game.physicalVehicle.events.on('flip', (direction) =>
        {
            if(direction > 0)
                this.game.achievements.setProgress('frontFlip', 1)
            else
                this.game.achievements.setProgress('backFlip', 1)
        })
    }

    setTimePlayed()
    {
        const localTimePlayed = localStorage.getItem('timePlayed')
        this.timePlayed = {}
        this.timePlayed.all = localTimePlayed ? parseFloat(localTimePlayed) : 0
        this.timePlayed.session = 0
        this.timePlayed.achieved = false

        setInterval(() =>
        {
            localStorage.setItem('timePlayed', this.timePlayed.all)
        }, 1000)
    }

    respawn(respawnName = null, callback = null)
    {
        this.game.overlay.show(() =>
        {
            if(typeof callback === 'function')
                callback()

            // Find respawn
            let respawn = respawnName ? this.game.respawns.getByName(respawnName) : this.game.respawns.getClosest(this.position)

            // Update physical vehicle
            this.game.physicalVehicle.moveTo(
                respawn.position,
                respawn.rotation
            )
            
            this.state = Player.STATE_DEFAULT
            this.game.overlay.hide()
        })
    }

    die()
    {
        this.state = Player.STATE_LOCKED
        
        gsap.delayedCall(2, () =>
        {
            this.respawn(null, () =>
            {
                this.state = Player.STATE_DEFAULT
            })
        })
    }

    honk()
    {
        // Suspensions
        const randomWheelIndex = Math.floor(Math.random() * 4)
        const previousState = this.suspensions[randomWheelIndex]
        this.suspensions[ randomWheelIndex ] = 'mid'

        gsap.delayedCall(0.15, () =>
        {
            if(this.suspensions[ randomWheelIndex ] === 'mid')
            {
                this.suspensions[ randomWheelIndex ] = previousState
            }
        })

        // Achievement
        this.game.achievements.addProgress('honk')
    }

    updatePrePhysics()
    {
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0

        if(this.state !== Player.STATE_DEFAULT)
            return

        /**
         * Accelerating
         */
        // Character mode: vehicle acceleration disabled
        this.accelerating = 0

        /**
        * Character mode: running/boost disabled for now
        */
        this.boosting = 0

        // Later:
            // if(this.game.inputs.actions.get('boost').active)
                //this.running = true

        /**
         * Braking
         */
        if(this.game.inputs.actions.get('brake').active)
        {
            this.accelerating = 0
            this.braking = 0
        }

        /**
         * Steering
         */
        // Character mode: vehicle steering disabled
        this.steering = 0

        // Gamepad / mobile joystick are now handled by PhysicsCharacter.
        // Vehicle steering / acceleration disabled in character mode.
        this.steering = 0
        this.accelerating = 0

        if(this.game.inputs.nipple.active && this.game.inputs.nipple.progress > 0)
        {
            if(!this.game.view.focusPoint.isTracking)
            {
                // Wait a few frames in case it's multi-touch
                this.game.ticker.wait(5, () =>
                {
                    if(this.game.inputs.nipple.active)
                        this.game.view.focusPoint.isTracking = true
                })
            }
        }
    }
    updatePostPhysics()
    {
        // Position
        this.position.copy(this.game.physicalVehicle.position)
        //this.position.copy(this.game.physicalCharacter.position)
        this.position2 = new THREE.Vector2(this.position.x, this.position.z)
        
        // View > Focus point
        this.game.view.focusPoint.trackedPosition.copy(this.position)

        // View > Speed lines
        if(this.boosting && this.accelerating && this.game.physicalVehicle.speed > 15)
            this.game.view.speedLines.strength = 1
        else
            this.game.view.speedLines.strength = 0

        this.game.view.speedLines.worldTarget.copy(this.position)

        // Tracks > Focus point
        this.game.tracks.focusPoint.set(this.position.x, this.position.z)

        // Inputs touch joystick
        this.rotationY = Math.atan2(this.game.physicalVehicle.forward.z, this.game.physicalVehicle.forward.x)
        //this.rotationY = this.game.physicalCharacter.rotationY
        this.game.inputs.nipple.setCoordinates(this.position.x, this.position.y, this.position.z, this.rotationY)

        // Sound
        if(
            this.game.physicalVehicle.wheels &&
            this.game.physicalVehicle.wheels.justTouchedCount > 1
        )
        {
            this.sounds.spring1.play(this.game.physicalVehicle.wheels.justTouchedCount)
            this.sounds.spring2.play(this.game.physicalVehicle.wheels.justTouchedCount)
        }

        // Time played
        this.timePlayed.all += this.game.ticker.delta
        this.timePlayed.session += this.game.ticker.delta

        if(!this.timePlayed.achieved && this.timePlayed.session > this.game.dayCycles.duration)
        {
            this.timePlayed.achieved = true
            this.game.achievements.setProgress('fullDay', 1)
        }

        // Sea achievement
        const distanceToCenter = this.position2.length()
        if(distanceToCenter > 120)
            this.game.achievements.setProgress('sea', 1)

        // Go high achievements
        const elevation = Math.floor(this.position.y)
        if(this.game.achievements.groups.get('goHigh') && elevation > this.game.achievements.groups.get('goHigh').progress)
            this.game.achievements.setProgress('goHigh', elevation)

        // // Speed achievement
        // const speedKmPerHour = Math.floor(this.game.physicalVehicle.xzSpeed / 1000 * 3600)

        // if(this.game.achievements.groups.get('speed') && speedKmPerHour > this.game.achievements.groups.get('speed').progress)
        //     this.game.achievements.setProgress('speed', speedKmPerHour)

        // Distance driven
        this.distanceDriven.value += this.game.physicalVehicle.xzSpeed * this.game.ticker.deltaScaled
        const flooredDistanceDriven = Math.floor(this.distanceDriven.value)

        if(flooredDistanceDriven !== this.distanceDriven.floored)
        {
            localStorage.setItem('distanceDriven', flooredDistanceDriven)
            this.distanceDriven.floored = flooredDistanceDriven
        }
        
        // Achievement
        const distanceDrivenKm = Math.floor(this.distanceDriven.value / 1000)

        if(this.game.achievements.groups.get('distanceDriven') && distanceDrivenKm > this.game.achievements.groups.get('distanceDriven').progress)
        {
            this.game.achievements.setProgress('distanceDriven', distanceDrivenKm)

        }
    }
}