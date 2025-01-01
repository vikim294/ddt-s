export class PlayersInfo {
  map = new Map()

  constructor() {
    this.map = new Map()
  }

  dispose() {
    
  }

  get size() {
    return this.map.size
  }

  getPlayerIds() {
    return Array.from(this.map.keys())
  }

  add(playerId, connectionType, socket, isReconnection) {
    this.map.set(playerId, {
      connectionType,
      socket,
      isReconnection
    })
  }

  remove(playerId) {
    this.map.delete(playerId)
  }

  get(playerId) {
    return this.map.get(playerId)
  }

  remove(playerId) {
    this.map.delete(playerId)
  }

  setBattlefieldByPlayerId(playerId, battlefield) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    playerInfo.battlefield = battlefield
  }

  getBattlefieldByPlayerId(playerId) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    return playerInfo.battlefield
  }
}
