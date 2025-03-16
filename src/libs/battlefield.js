import { v4 as uuidv4 } from "uuid";

export class Battlefield {
  id = null;
  players = [];
  activePlayerIndex = null;

  isActivePlayerFiring = false
  playerIdsOnReconnection = []
  
  /**
   * 记录所有对 terrain 有效的bombTarget
   * 用于 reconnection 时更新 canvas
   */
  validBombTargets = []

  constructor() {
    this.id = uuidv4();
  }

  dispose() {
    this.id = null;
    this.players = [];
    this.activePlayerIndex = null;
    this.isActivePlayerFiring = false;
    this.playerIdsOnReconnection = [];
    this.validBombTargets = [];
  }

  get activePlayer() {
    return this.players[this.activePlayerIndex]
  }

  get playerNum() {
    return this.players.length;
  }

  get isAllOnlie() {
    return this.players.every((item) => item.isOnline);
  }

  get isAllOffline() {
    return this.players.every((item) => !item.isOnline);
  }

  add(player, index) {
    if (index === 0) {
      // player.centerPoint = { x: 1147, y: 385 };
      player.centerPoint = { x: 744, y: 344 };
      player.direction = "right";
    } else if (index === 1) {
      // player.centerPoint = { x: 1546, y: 710 };
      player.centerPoint = { x: 1156, y: 516 };
      player.direction = "left";
    }

    this.players.push(player);
  }

  getPlayer(playerId) {
    return this.players.find((item) => item.id === playerId);
  }

  remove(playerId) {
    this.players = this.players.filter((item) => item.id !== playerId);
  }

  getPlayerIsOnline(playerId) {
    const player = this.getPlayer(playerId);
    if (player) {
      return player.isOnline
    }
    return null
  }

  setPlayerIsOnline(playerId, isOnline) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isOnline = isOnline;
    }
  }

  calculateActivePlayerIndex() {
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
  }

  addReconnectionPlayer(playerId) {
    if(!this.isPlayerOnReconnection(playerId)) {
      this.playerIdsOnReconnection.push(playerId)
    }
  }

  isPlayerOnReconnection(playerId) {
    return this.playerIdsOnReconnection.includes(playerId)
  }

  getBombTarget(bombId) {
    return this.validBombTargets.find(item => item.bombId === bombId)
  }

  addBombTarget(bombTarget) {
    this.validBombTargets.push(bombTarget)
  }

  updatePlayerInfoInBattlefield(playerInfo) {
    const {
      id,
      centerPoint,
      direction,
      health,
    } = playerInfo

    const player = this.getPlayer(id);
    if (!player) {
      return
    }

    if(centerPoint) {
      player.centerPoint = centerPoint;
    }
    if(direction) {
      player.direction = direction;
    }
    if(health) {
      player.health = health;
    }
  }
}
