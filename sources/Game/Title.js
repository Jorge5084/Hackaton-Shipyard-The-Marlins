import { Game } from './Game.js'

export class Title
{
    constructor()
    {
        this.game = Game.getInstance()
        document.title = 'Astillero Marlin'
    }

    update()
    {
    }
}