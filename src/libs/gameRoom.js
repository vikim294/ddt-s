class GameRoom {
    id = null
    hostId = null
    createdAt = null
    size = 2
    status = 'waiting'
    players = []

    constructor(options) {
        this.id = options.id
        this.hostId = options.hostId
        this.createdAt = options.createdAt
        this.players = options.players
    }

    findPlayerById(userId) {
        return this.players.find(item => item.id === userId)
    }

    addPlayer(player) {
        if(!this.findPlayerById(player.id)) {
            this.players.push(player)
            this.size++
        }
    }

    removePlayerById(userId) {
        this.players = this.players.filter(item => item.id !== userId)
    }

}

class GameRooms {
    rooms = []

    constructor() {}

    /**
     * options:
     * ```
     *  id
        hostId
        createdAt
        players
     * ```
        player:
        ```
            id: 用户id,
            name: 用户名,
            level: 等级,
        ```
     */
    createRoom(options) {
        const room = new GameRoom(options)
        this.rooms.push(room)
    }

    getRoomById(roomId) {
        return this.rooms.find(item => item.id === roomId)
    }

    deleteRoomById(roomId) {
        this.rooms = this.rooms.filter(item => item.id !== roomId)
    }


}

export const gameRooms = new GameRooms()