import { v4 as uuidv4 } from "uuid";

export class Battlefield {
  id = null;
  players = [];
  activePlayerIndex = null;

  constructor() {
    this.id = uuidv4();
  }

  dispose() {
    this.id = null;
    this.players = [];
    this.activePlayerIndex = null;
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

  has(playerId) {
    return this.players.find((item) => item.id === playerId);
  }

  getPlayerIsOnline(playerId) {
    const player = this.players.find((item) => item.id === playerId);
    if (player) {
      return player.isOnline
    }
    return null
  }

  setPlayerIsOnline(playerId, isOnline) {
    const player = this.players.find((item) => item.id === playerId);
    if (player) {
      player.isOnline = isOnline;
    }
  }

  calculateActivePlayerIndex() {
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
  }
}
