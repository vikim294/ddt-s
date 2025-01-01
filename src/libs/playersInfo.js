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

  add(playerId) {
    this.map.set(playerId, {})
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

  getSocket(playerId) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    return playerInfo.socket
  }

  setSocket(playerId, socket) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    playerInfo.socket = socket
  }

  setBattlefield(playerId, battlefield) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    playerInfo.battlefield = battlefield
  }

  getBattlefield(playerId) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    return playerInfo.battlefield
  }

  getIsReconnection(playerId) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    return playerInfo.isReconnection
  }

  setIsReconnection(playerId, isReconnection) {
    const playerInfo = this.get(playerId)
    if(!playerInfo) return null
    playerInfo.isReconnection = isReconnection
  }
}
