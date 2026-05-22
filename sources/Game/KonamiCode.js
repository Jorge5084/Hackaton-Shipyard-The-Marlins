import * as THREE from 'three/webgpu'
import { Game } from './Game.js'

export class KonamiCode
{
    constructor(once = false)
    {
        this.game = Game.getInstance()

        let index = 0
        this.activationCount = 0
        this.sounds = {}

        this.sounds.surprise = this.game.audio.register({
            path: 'sounds/achievements/Money Reward 2.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 0.5
        })

        const sequence = [
            [ 'KeyW' ],
            [ 'KeyW' ],
            [ 'KeyD' ],
            [ 'KeyD' ],
            [ 'KeyS' ],
            [ 'KeyS' ],
            [ 'KeyA' ],
            [ 'KeyA' ],
        ]

        const callback = (event) =>
        {
            const sequenceItem = sequence[index]

            if(sequenceItem.indexOf(event.code) !== -1)
            {
                index++

                if(index === sequence.length)
                {
                    this.activate()

                    if(once)
                        document.removeEventListener('keydown', callback)

                    index = 0
                }
            }
            else
            {
                index = 0
            }
        }

        document.addEventListener('keydown', callback)
    }

    async activate()
    {
        const visualCharacter = this.game.world.visualPlayer?.visualCharacter

        if(visualCharacter && visualCharacter.toggleCharacter)
        {
            visualCharacter.toggleCharacter()

            const isRobot = visualCharacter.currentCharacter === 'robot'

            if(isRobot && this.game.notifications)
            {
                const html = /* html */`
                    <div class="top" style="justify-content: center; text-align: center;">
                        <div class="title" style="color: white; width: 100%;">
                            SURPRISE!!
                        </div>
                    </div>
                `

                this.game.notifications.show(
                    html,
                    'easter-egg',
                    1,
                    null,
                    'character-easter-egg'
                )

                if(this.game.world.confetti)
                {
                    this.game.world.confetti.pop(this.game.player.position.clone())
                    this.game.world.confetti.pop(this.game.player.position.clone().add(new THREE.Vector3(1, -1, 1.5)))
                    this.game.world.confetti.pop(this.game.player.position.clone().add(new THREE.Vector3(1, -1, -1.5)))
                }

                this.sounds.surprise.play()
            }
        }

        this.activationCount++
    }
}