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
    // console.log('----- add playerInfo -----')
    // console.log(this.getPlayerIds())
    // this.map.forEach((v, k) => {
    //   console.log(`playerId: ${k}`)
    //   console.log(`socketId:`, v.socket?.id)
    //   console.log(`battlefieldId`, v.battlefield?.id)
    // })
  }

  remove(playerId) {
    this.map.delete(playerId)
  }

  get(playerId) {
    const playerInfo = this.map.get(playerId)
    if(!playerInfo) {
      throw new Error(`playerInfo ${playerId} is null`)
    }
    return playerInfo
  }

  getSocket(playerId) {
    const playerInfo = this.get(playerId)
    return playerInfo.socket
  }

  setSocket(playerId, socket) {
    const playerInfo = this.get(playerId)
    playerInfo.socket = socket
  }

  getBattlefield(playerId) {
    const playerInfo = this.get(playerId)
    return playerInfo.battlefield
  }

  setBattlefield(playerId, battlefield) {
    const playerInfo = this.get(playerId)
    playerInfo.battlefield = battlefield
  }

  getIsReconnection(playerId) {
    const playerInfo = this.get(playerId)
    return playerInfo.isReconnection
  }

  setIsReconnection(playerId, isReconnection) {
    const playerInfo = this.get(playerId)
    playerInfo.isReconnection = isReconnection
  }
}
