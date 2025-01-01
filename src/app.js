export {};

import { createServer } from "http";
import { Server } from "socket.io";
import { MatchingPool } from "./libs/matchingPool.js";
import { Battlefield } from "./libs/battlefield.js";
import { PlayersInfo } from "./libs/playersInfo.js";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  // connectionStateRecovery: {
  //   maxDisconnectionDuration: 2 * 60 * 1000,
  //   skipMiddlewares: true,
  // }
});

httpServer.listen(3000, () => {
  console.log("server is listening on 3000");
});

const matchingPool = new MatchingPool();
const playerInfos = new PlayersInfo();

io.on("connection", (socket) => {
  const playerId = socket.handshake.auth.token;
  const connectionType = socket.handshake.query.connectionType;

  console.log(
    `[connected] ${playerId} connected! connectionType: ${connectionType}`
  );

  const playerInfo = playerInfos.get(playerId);
  if (playerInfo) {
    // reconnect
    // 断开之前的socket，并替换为新的socket
    playerInfo.socket.disconnect();
    playerInfo.socket = socket;

    // 如果之前是battlefield
    if (playerInfo.connectionType === "battlefield") {
      // battlefield 重连
      playerInfo.isReconnection = true;
    }

    playerInfo.connectionType = connectionType;
  } else {
    // new connection
    playerInfos.add(playerId, connectionType, socket, false);
  }

  // if(socket.recovered) {
  //   console.log(`${playerId} recovered!`);
  // }
  // else {
  // console.log(`${playerId} connected!`);
  // }

  socket.on("requestMatching", (client) => {
    console.log(`[requestMatching] ${client.id}`);
    if (matchingPool.has(client.id)) return;
    matchingPool.add(client);
    const matchedPlayers = matchingPool.tryToMatch(client);
    if (matchedPlayers) {
      console.log("[matchmakingCompleted]", matchedPlayers);

      // uuid
      const battlefield = new Battlefield();

      io.emit("matchmakingCompleted", matchedPlayers, battlefield.id);
      matchedPlayers.forEach((player) => {
        // 将 players加入 battlefield
        battlefield.add(player);

        // 将player, socket, battlefield 关联
        playerInfos.setBattlefieldByPlayerId(player.id, battlefield);
      });
    }
  });

  // cancelMatching
  socket.on("cancelMatching", () => {
    console.log("cancelMatching\n", playerId);

    matchingPool.remove(playerId);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[disconnected] ${playerId} ${reason}`);
    const playerInfo = playerInfos.get(playerId);

    switch (reason) {
      case "client namespace disconnect": {
        // 客户端主动断开连接

        // 玩家在比赛中
        if (playerInfo) {
          if (playerInfo.connectionType === "battlefield") {
            // 主动退出比赛
            console.log(`[playerLeaveGame] ${playerId}`);
            // 通知其他玩家
            io.emit("playerLeaveGame", playerId);

            // 移除battlefield中的player
            const battlefield = playerInfo.battlefield;
            battlefield.remove(playerId);

            // 当battlefield中没有玩家时，销毁battlefield
            if (battlefield.playerNum === 0) {
              console.log(`[dispose battlefield] ${battlefield.id}`);
              battlefield.dispose();
            }

            // 移除playerInfo
            playerInfos.remove(playerId);

            console.log(
              `playerInfos(${playerInfos.size}):`,
              playerInfos.getPlayerIds()
            );
          }
        }
        break;
      }

      case "transport close": {
        // 客户端网络异常断开连接 / 客户端关闭浏览器

        // 玩家在比赛中
        if (playerInfo) {
          console.log(`[playerOffline] ${playerId}`);
          // 通知其他玩家
          io.emit("playerOffline", playerId);
        }
        break;
      }

      default: {
        break;
      }
    }

    // remove from matchmakingPool (if exists)
    matchingPool.remove(playerId);

    // players = players.filter(player => player.id !== playerId)
  });

  socket.on("joinBattlefield", () => {
    const { battlefield, isReconnection } = playerInfos.get(playerId);

    if (isReconnection) {
      // 如果是重连
      console.log(`[reconnectBattlefield] ${playerId}`);
      // player重新连接：同步数据，并通知其他玩家，
      io.emit("playerReconnectsBattlefield", playerId);
    } else {
      // 如果是第一次
      console.log(`[joinBattlefield] ${playerId} ${battlefield.id}`);
      battlefield.setPlayerIsOnline(playerId, true);

      if (battlefield.isAllOnlie) {
        const players = battlefield.players.map((player, index) => {
          let centerPoint = null;
          let direction = null;
          if (index === 0) {
            centerPoint = { x: 1147, y: 385 };
            direction = "right";
          } else if (index === 1) {
            centerPoint = { x: 1546, y: 710 };
            direction = "left";
          }

          return {
            id: player.id,
            name: player.id,
            level: player.level,
            centerPoint,
            direction,
            healthMax: 1000,
            weapon: {
              angleRange: 30,
              damage: 250,
            },
          };
        });
        battlefield.activePlayerIndex = 0;
        const data = {
          activePlayerId: battlefield.players[battlefield.activePlayerIndex].id,
          players,
        };
        console.log("initBattlefield", data);
        io.emit("initBattlefield", data);
      }
    }
  });

  // onPlayerConnection({
  //   playerId,
  // })

  // activePlayerMove
  socket.on("activePlayerMove", (direction) => {
    const battlefield = playerInfos.getBattlefieldByPlayerId(playerId);
    if (!battlefield) return;
    console.log(
      `battlefieldId: ${battlefield.id} ${
        battlefield.players[battlefield.activePlayerIndex].id
      } activePlayerMove ${direction}`
    );
    io.emit("activePlayerMove", direction);
  });

  socket.on("activePlayerMoveEnd", (centerPoint) => {
    const battlefield = playerInfos.getBattlefieldByPlayerId(playerId);
    if (!battlefield) return;

    console.log(
      `battlefieldId: ${battlefield.id} ${
        battlefield.players[battlefield.activePlayerIndex].id
      } activePlayerMoveEnd x, y: ${centerPoint.x}, ${centerPoint.y}`
    );
    io.emit("activePlayerMoveEnd", centerPoint);
  });

  socket.on("activePlayerFall", (centerPoint) => {
    console.log(
      `${players[activePlayerIndex].id} activePlayerFall x, y: ${centerPoint.x}, ${centerPoint.y}`
    );
    io.emit("activePlayerFall", centerPoint);
  });

  // activePlayerFire
  socket.on("activePlayerFire", (firingData) => {
    console.log(`${players[activePlayerIndex].id} activePlayerFire`);
    io.emit("activePlayerFire", firingData);
  });

  socket.on("syncBombDataBeforePlayerFires", (bombsData) => {
    console.log(
      `${players[activePlayerIndex].id} syncBombDataBeforePlayerFires`
    );
    io.emit("syncBombDataBeforePlayerFires", bombsData);
  });

  // startNextTurn
  socket.on("startNextTurn", () => {
    activePlayerIndex = (activePlayerIndex + 1) % players.length;
    console.log(`startNextTurn activePlayer: ${players[activePlayerIndex].id}`);
    io.emit("startNextTurn", {
      activePlayerId: players[activePlayerIndex].id,
    });
  });
});

function onPlayerConnection({ playerId }) {
  if (players.find((player) => player.id === playerId)) return;
  if (players.length === 0) {
    // 1
    players[0] = {
      id: playerId,
      name: playerId,
      centerPoint: {
        x: 1147,
        y: 385,
      },
      direction: "right",

      healthMax: 1000,

      weapon: {
        angleRange: 30,
        damage: 250,
      },
    };
    return;
  }

  if (players.length === 1) {
    // 2
    players[1] = {
      id: playerId,
      name: playerId,
      centerPoint: {
        x: 1546,
        y: 710,
      },
      direction: "left",

      healthMax: 1000,

      weapon: {
        angleRange: 30,
        damage: 250,
      },
    };

    // 匹配完成
    console.log("匹配完成");
    activePlayerIndex = 0;
    io.emit("matchCompleted", {
      activePlayerId: players[activePlayerIndex].id,
      players,
    });
  }
}
