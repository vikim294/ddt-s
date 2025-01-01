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

  get playerNum() {
    return this.players.length;
  }

  get isAllOnlie() {
    return this.players.every((item) => item.isOnline);
  }

  get isAllOffline() {
    return this.players.every((item) => !item.isOnline);
  }

  add(player) {
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
}
