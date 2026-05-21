import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { VisualCharacter } from './VisualCharacter.js'

export class VisualPlayer
{
    constructor()
    {
        this.game = Game.getInstance()

        this.container = new THREE.Group()
        this.container.name = 'VisualPlayer'
        this.game.scene.add(this.container)

        this.visualCharacter = new VisualCharacter(this.container)

        this.screenPosition = {
            x: 0,
            y: 0,
        }

        this.tickCallback = () =>
        {
            this.update()
        }

        this.game.ticker.events.on('tick', this.tickCallback, 8)
    }

    update()
    {
        const physicalCharacter = this.game.physicalCharacter || this.game.physicalVehicle

        if(!physicalCharacter)
            return

        this.container.position.copy(physicalCharacter.position)
        this.container.quaternion.copy(physicalCharacter.quaternion)

        // Screen position, por compatibilidad con UI vieja
        const vector = new THREE.Vector3()
        vector.setFromMatrixPosition(this.container.matrixWorld)
        vector.project(this.game.view.camera)

        this.screenPosition.x = vector.x * 0.5 + 0.5
        this.screenPosition.y = vector.y * -0.5 + 0.5
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this.tickCallback)

        if(this.visualCharacter && this.visualCharacter.destroy)
            this.visualCharacter.destroy()

        this.container.removeFromParent()
    }
}