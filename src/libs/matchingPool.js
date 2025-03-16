export class MatchingPool {
  pool = [];

  constructor() {

  }

  dispose() {
    this.pool = [];
  }

  add(client) {
    this.pool.push(client);
  }

  remove(playerId) {
    this.pool = this.pool.filter((item) => item.player.id !== playerId);
  }

  has(playerId) {
    return this.pool.find((item) => item.player.id === playerId);
  }

  tryToMatch(client) {
    let minimumLevelDifference = 100;
    let matchedClient = null;
    this.pool.forEach((item) => {
      if (item.player.id !== client.player.id) {
        const gap = Math.abs(item.player.level - client.player.level);
        if (gap < minimumLevelDifference) {
          minimumLevelDifference = gap;
          matchedClient = item;
        }
      }
    });

    if (matchedClient !== null) {
      return [client, matchedClient];
    }

    return null;
  }
}
