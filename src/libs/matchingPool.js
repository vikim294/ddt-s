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

  remove(clientId) {
    this.pool = this.pool.filter((item) => item.id !== clientId);
  }

  has(clientId) {
    return this.pool.find((item) => item.id === clientId);
  }

  tryToMatch(client) {
    let minimumLevelDifference = 100;
    let matchedPlayer = null;
    this.pool.forEach((item) => {
      if (item.id !== client.id) {
        const gap = Math.abs(item.level - client.level);
        if (gap < minimumLevelDifference) {
          minimumLevelDifference = gap;
          matchedPlayer = item;
        }
      }
    });

    if (matchedPlayer !== null) {
      return [client, matchedPlayer];
    }

    return null;
  }
}
