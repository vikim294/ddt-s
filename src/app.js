export { };

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
  console.log(`server is running at http://127.0.0.1:3000`);
});

const matchingPool = new MatchingPool();
const playerInfos = new PlayersInfo();

const matchmakingNamespace = io.of("/matchmaking");
const battlefieldNamespace = io.of("/battlefield");

matchmakingNamespace.on("connection", (socket) => {
  const playerId = socket.handshake.auth.token;

  console.log(`[matchmaking/connected] ${playerId} connected!`);

  socket.on("requestMatching", (player) => {
    console.log(`[matchmaking/requestMatching] ${player.id}`);
    if (matchingPool.has(player.id)) return;
    matchingPool.add(player);
    const matchedPlayers = matchingPool.tryToMatch(player);
    if (matchedPlayers) {
      console.log("[matchmaking/matchmakingCompleted]", matchedPlayers);

      // battlefield
      const battlefield = new Battlefield();

      matchmakingNamespace.emit(
        "matchmakingCompleted",
        matchedPlayers,
        battlefield.id
      );
      matchedPlayers.forEach((player, index) => {
        // 将 players加入 battlefield
        battlefield.add(player, index);

        // 将player, battlefield 关联
        playerInfos.add(player.id);
        playerInfos.setBattlefield(player.id, battlefield);
      });
    }
  });

  // cancelMatching
  socket.on("cancelMatching", () => {
    console.log(`[matchmaking/cancelMatching] ${playerId}`);

    matchingPool.remove(playerId);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[matchmaking/disconnected] ${playerId} reason: ${reason}`);

    switch (reason) {
      case "client namespace disconnect": {
        // 客户端主动断开连接

        break;
      }

      case "transport close": {
        // 客户端网络异常断开连接 / 客户端关闭浏览器

        // 玩家在比赛中

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
});

battlefieldNamespace.on("connection", (socket) => {
  const playerId = socket.handshake.auth.token;

  console.log(`[battlefield/connected] ${playerId} connected!`);

  const playerInfoSocket = playerInfos.getSocket(playerId);
  const battlefield = playerInfos.getBattlefield(playerId);
  // join battlefield (room)
  socket.join(battlefield.id);
  if (!playerInfoSocket) {
    // new connection
    playerInfos.setSocket(playerId, socket);
    playerInfos.setIsReconnection(playerId, false);
  } else {
    // reconnect
    // 断开之前的socket，并替换为新的socket
    playerInfoSocket.leave(battlefield.id);
    playerInfoSocket.disconnect();
    playerInfos.setSocket(playerId, socket);
    playerInfos.setIsReconnection(playerId, true);
  }

  socket.on("disconnect", (reason) => {
    console.log(`[battlefield/disconnected] ${playerId} reason: ${reason}`);
    const battlefield = playerInfos.getBattlefield(playerId);

    switch (reason) {
      case "client namespace disconnect": {
        // 客户端主动断开连接

        // 主动退出比赛
        console.log(`[battlefield/playerLeaveGame] ${playerId}`);

        // 移除battlefield中的player
        battlefield.remove(playerId);

        // 通知其他玩家
        battlefieldNamespace.in(battlefield.id).emit("playerLeaveGame", playerId);

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
        break;
      }

      case "transport close": {
        // 客户端网络异常断开连接 / 客户端关闭浏览器

        // 玩家在比赛中
        console.log(`[battlefield/playerOffline] ${playerId}`);
        battlefield.setPlayerIsOnline(playerId, false);
        // 通知其他玩家
        battlefieldNamespace.in(battlefield.id).emit("playerOffline", playerId);
        break;
      }

      default: {
        break;
      }
    }
  });

  socket.on("joinBattlefield", () => {
    const { battlefield, isReconnection } = playerInfos.get(playerId);

    if (isReconnection) {
      // 如果是重连
      console.log(`[battlefield/reconnectBattlefield] ${playerId}`);
      // player重新连接：同步数据，并通知其他玩家，
      const data = {
        reconnectionPlayerId: playerId,
        activePlayerId: battlefield.players[battlefield.activePlayerIndex].id,
        players: battlefield.players
      }
      battlefieldNamespace.in(battlefield.id).emit("playerReconnectsBattlefield", data);
    } else {
      // 如果是第一次
      console.log(
        `[battlefield/joinBattlefield] ${playerId} ${battlefield.id}`
      );
      battlefield.setPlayerIsOnline(playerId, true);

      if (battlefield.isAllOnlie) {
        battlefield.activePlayerIndex = 0;
        const data = {
          activePlayerId: battlefield.players[battlefield.activePlayerIndex].id,
          players: battlefield.players
        };
        console.log("[battlefield/initBattlefield]", data);
        battlefieldNamespace.in(battlefield.id).emit("initBattlefield", data);
      }
    }
  });

  // activePlayerMove
  socket.on("activePlayerMove", (direction) => {
    const battlefield = playerInfos.getBattlefield(playerId);
    if (!battlefield) return;
    console.log(
      `battlefieldId: ${battlefield.id} ${battlefield.players[battlefield.activePlayerIndex].id
      } activePlayerMove ${direction}`
    );
    battlefieldNamespace.in(battlefield.id).emit("activePlayerMove", direction);
  });

  socket.on("activePlayerMoveEnd", (centerPoint, direction) => {
    const battlefield = playerInfos.getBattlefield(playerId);
    if (!battlefield) return;

    console.log(
      `[activePlayerMoveEnd] battlefieldId: ${battlefield.id} ${battlefield.players[battlefield.activePlayerIndex].id
      } x, y: ${centerPoint.x}, ${centerPoint.y} direction: ${direction}`
    );

    const player = battlefield.getPlayer(playerId)
    if (!player) {
      console.log(`player ${playerId} is null`)
      return
    }

    player.centerPoint = centerPoint
    player.direction = direction

    battlefieldNamespace.in(battlefield.id).emit("activePlayerMoveEnd", centerPoint, direction);
  });

  socket.on("activePlayerFall", (centerPoint) => {
    const battlefield = playerInfos.getBattlefield(playerId);
    if (!battlefield) return;

    console.log(
      `[activePlayerFall] battlefieldId: ${battlefield.id} ${battlefield.players[battlefield.activePlayerIndex].id
      } x, y: ${centerPoint.x}, ${centerPoint.y}`
    );
    battlefieldNamespace.in(battlefield.id).emit("activePlayerFall", centerPoint);
  });

  // playerUsesSkill
  socket.on("playerUsesSkill", (playerId, skill) => {
    const battlefield = playerInfos.getBattlefield(playerId);
    if (!battlefield) return;

    console.log(`[playerUsesSkill] battlefieldId: ${battlefield.id} ${battlefield.players[battlefield.activePlayerIndex].id
      }`);
    battlefieldNamespace.in(battlefield.id).emit("playerUsesSkill", skill);
  });

  // activePlayerFire
  socket.on("activePlayerFire", (firingData) => {
    const battlefield = playerInfos.getBattlefield(playerId);
    if (!battlefield) return;

    console.log(`[activePlayerFire] battlefieldId: ${battlefield.id} ${battlefield.players[battlefield.activePlayerIndex].id
      }`);
    battlefieldNamespace.in(battlefield.id).emit("activePlayerFire", firingData);
  });

  socket.on("syncBombDataBeforePlayerFires", (bombsData, isTrident) => {
    const battlefield = playerInfos.getBattlefield(playerId);
    if (!battlefield) return;

    console.log(
      `[syncBombDataBeforePlayerFires] battlefieldId: ${battlefield.id} ${battlefield.players[battlefield.activePlayerIndex].id
      }`
    );
    battlefieldNamespace.in(battlefield.id).emit("syncBombDataBeforePlayerFires", bombsData, isTrident);
  });

  // startNextTurn
  socket.on("startNextTurn", () => {
    const battlefield = playerInfos.getBattlefield(playerId);
    if (!battlefield) return;

    battlefield.calculateActivePlayerIndex();
    console.log(`[startNextTurn] battlefieldId: ${battlefield.id} activePlayer: ${battlefield.activePlayer.id}
      }`);
    battlefieldNamespace.in(battlefield.id).emit("startNextTurn", {
      activePlayerId: battlefield.activePlayer.id
    });
  });
});
