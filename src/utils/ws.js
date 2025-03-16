import { Server } from "socket.io";
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from 'uuid';

import { MatchingPool } from "../libs/matchingPool.js";
import { Battlefield } from "../libs/battlefield.js";
import { PlayersInfo } from "../libs/playersInfo.js";
import { JWT_SECRET } from "./constant.js";
import { gameRooms } from "../libs/gameRoom.js";
import { getUserById } from "../services/user.js";

const initWs = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
          origin: "*",
        },
        // connectionStateRecovery: {
        //   maxDisconnectionDuration: 2 * 60 * 1000,
        //   skipMiddlewares: true,
        // }
      });
      
      const matchingPool = new MatchingPool();
      const playerInfos = new PlayersInfo();
      
      // connection
      io.on("connection", async (socket) => {
        const token = socket.handshake.auth.token;
        if(!token) {
          console.error('connection failed: no token provided')
          return
        }

        // 验证并解析 token
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            // console.log('decoded', decoded)

            const {
              id,
              name
            } = decoded

            console.log(`[connected] ${id}/${name} connected!`);
            // console.log('----- playerInfo list -----')
            // console.log(playerInfos.getPlayerIds())
            // playerInfos.map.forEach((v, k) => {
            //   console.log(`playerId: ${k}`)
            //   console.log(`socketId:`, v.socket?.id)
            //   console.log(`battlefieldId`, v.battlefield?.id)
            // })

            const playerId = +id
            try {
              const playerInfo = playerInfos.get(playerId)

              // old   
              playerInfos.setIsReconnection(playerId, false)

              // reconnect 
              const { socket: playerInfoSocket, battlefield: playerInfoBattlefield } = playerInfo
              console.log('55 old reconnect', playerId, playerInfoBattlefield)
              if(playerInfoSocket) {
                if(playerInfoBattlefield) {
                  // --- reconnect battfield
                  // 之前的 socket 离开 battlefield
                  playerInfoSocket.leave(playerInfoBattlefield.id);
                  // socket 加入 battlefield
                  socket.join(playerInfoBattlefield.id);
                  // 如果已经在 battlefield 中了，设置 reconnection 为 true
                  playerInfos.setIsReconnection(playerId, true);
                  playerInfoBattlefield.setPlayerIsOnline(playerId, true);
                }

                // 断开之前的socket
                console.log('断开之前的socket')
                playerInfoSocket.disconnect();
              }
            } catch (error) {
              console.log('73 error', error)
              // new
              console.log('brand new', playerId)
              playerInfos.add(playerId)
              playerInfos.setIsReconnection(playerId, false)
            }
       
            playerInfos.setSocket(playerId, socket);

            if(playerInfos.getIsReconnection(playerId)) {
                // 如果是重连 battlefield
                console.log(`[reconnect battlefield] ${playerId}`);

                const battlefield = playerInfos.getBattlefield(playerId)
                console.log('重连 battlefield', battlefield)

                if(battlefield.isActivePlayerFiring) {
                  // player重新连接 battlefield
                  // 通知 重连的player 先等待 直到 nextTurn
                  battlefield.addReconnectionPlayer(playerId)
                  socket.emit('waitUntilNextTurn')
                }
                else {
                  // player重新连接 battlefield
                  // 同步数据，并通知其他玩家
                  const data = {
                    reconnectionPlayerId: playerId,
                    validBombTargets: battlefield.validBombTargets,
                    activePlayerId: battlefield.activePlayer.id,
                    playersData: battlefield.players
                  }
                  io.in(battlefield.id).emit("playerReconnectsBattlefield", data);

                  playerInfos.setIsReconnection(playerId, false)
                }
            }

            // disconnect
            socket.on("disconnect", (reason) => {
              console.log(`disconnected ${playerId} reason: ${reason}`);
              const battlefield = playerInfos.getBattlefield(playerId);
          
              switch (reason) {
                case "client namespace disconnect": {
                  // 客户端主动断开连接

                  break;
                }

                case "server namespace disconnect": {
                  // 服务器主动断开socket的连接

                  break;
                }

                case "ping timeout": {
                  // 客户端网络异常断开连接 / 客户端关闭浏览器

                }
          
                case "transport close": {
                  // 客户端网络异常断开连接 / 客户端关闭浏览器

                  if(battlefield) {
                    // 玩家在比赛中
                    console.log(`[battlefield/playerOffline] ${playerId}`);
                    battlefield.setPlayerIsOnline(playerId, false);
                    // 通知其他玩家
                    io.in(battlefield.id).emit("playerOffline", playerId);
                  }



          

                  break;
                }
          
                default: {
                  break;
                }
              }
            });

            // --- gameRoom
            // createGameRoom
            socket.on("createGameRoom", async ({hostId}) => {
              console.log(`[createGameRoom] ${id}/${name}`);

              // 查找房主信息
              const host = await getUserById(hostId)

              // 创建房间
              const gameRoomId = uuidv4()
              gameRooms.createRoom({
                id: gameRoomId,
                hostId,
                createdAt: new Date().toLocaleString(),
                players: [host]
              })

              // 返回房间id
              socket.emit('gameRoomCreated', gameRoomId)
            })

            // enterRoom
            socket.on("enterRoom", async (gameRoomId) => {
              console.log(`[enterRoom] ${playerId}/${name}`);

              // gameRoom数据
              const gameRoom = gameRooms.getRoomById(gameRoomId)
              if(!gameRoom) {
                throw new Error(`gameRoom ${gameRoom} is null`);
              }

              // socket 加入 room
              socket.join(gameRoomId)

              // broadcast in room
              io.in(gameRoomId).emit('enterRoom', gameRoom)
            })

            // leaveRoom
            socket.on("leaveRoom", async ({userId, gameRoomId}) => {
              console.log(`[leaveRoom] ${id}/${name}`);

              // socket 离开 room
              socket.leave(gameRoomId)

              // 更新 gameRoom数据
              const gameRoom = gameRooms.getRoomById(gameRoomId)
              if(!gameRoom) return
              gameRoom.removePlayerById(userId)

              if(gameRoom.players.length > 0) {
                // 如果离开的是 房主
                if(userId === gameRoom.hostId) {
                  // 设置新房主
                  gameRoom.hostId = gameRoom.players[0].id
                }

                // broadcast in room
                io.in(gameRoomId).emit('leaveRoom', gameRoom)
              }
              else {
                // 删除房间
                gameRooms.deleteRoomById(gameRoom.id)
              }
            })

            // --- matchmaking
            // requestMatching
            socket.on("requestMatching", (player) => {
              console.log(`[requestMatching] ${player.id}`);

              if (matchingPool.has(player.id)) return;
              const client = {
                player,
                socket
              }
              matchingPool.add(client);

              const matchedClients = matchingPool.tryToMatch(client);
              if (matchedClients) {
                const matchedPlayers = matchedClients.map(item => item.player)
                console.log("[matchmakingCompleted]", matchedPlayers);
          
                // battlefield
                const battlefield = new Battlefield();

                matchedClients.forEach((client, index) => {
                  // 从 matchingPool 清除
                  matchingPool.remove(client.player.id);
                  
                  // 通知客户端 匹配完成
                  client.socket.emit(
                    "matchmakingCompleted",
                    matchedPlayers,
                    battlefield.id
                  );

                  // 将 player 加入 battlefield
                  battlefield.add(client.player, index);
                  battlefield.setPlayerIsOnline(client.player.id, true);
                  client.socket.join(battlefield.id)
                  // 将 player, battlefield 关联
                  playerInfos.setBattlefield(client.player.id, battlefield);
                })
              }
            });
          
            // cancelMatching
            socket.on("cancelMatching", () => {
              console.log(`[cancelMatching] ${playerId}`);
          
              matchingPool.remove(playerId);
            });

            // --- battlefield
            // joinBattlefield
            socket.on("joinBattlefield", () => {
              try {
                const playerInfo = playerInfos.get(playerId);

                if(playerInfo.isReconnection) {
                  console.log(`[joinBattlefield] reconnect battlefiled ${playerId}`)
                  return
                }
  
                const { battlefield } = playerInfo
                if(!battlefield) {
                  throw new Error(`${playerId} battlefield is null`);
                }
  
                console.log(
                  `[joinBattlefield] ${playerId} ${battlefield.id}`
                );
  
                if (battlefield.isAllOnlie) {
                  battlefield.activePlayerIndex = 0;
                  const data = {
                    activePlayerId: battlefield.activePlayer.id,
                    playersData: battlefield.players
                  };
                  // console.log("[initBattlefield]", data);
                  socket.emit("initBattlefield", data);
                }
                
              } catch (error) {
                console.log('joinBattlefield', error)
              }
            });

            // activePlayerMove
            socket.on("activePlayerMove", (direction) => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;
              
              console.log(
                `battlefieldId: ${battlefield.id} [activePlayerMove] ${battlefield.activePlayer.id
                } ${direction}`
              );
              io.in(battlefield.id).emit("activePlayerMove", direction);
            });

            // activePlayerMoving
            socket.on("activePlayerMoving", (centerPoint) => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;

              battlefield.updatePlayerInfoInBattlefield({
                id: playerId,
                centerPoint,
              })
            })
          
            socket.on("activePlayerMoveEnd", (centerPoint, direction) => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;
          
              console.log(
                `[activePlayerMoveEnd] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
                } x, y: ${centerPoint.x}, ${centerPoint.y} direction: ${direction}`
              );
          
              battlefield.updatePlayerInfoInBattlefield({
                id: playerId,
                centerPoint,
                direction
              })
          
              io.in(battlefield.id).emit("activePlayerMoveEnd", centerPoint, direction);
            });
          
            socket.on("activePlayerFall", (centerPoint) => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;
          
              console.log(
                `[activePlayerFall] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
                } x, y: ${centerPoint.x}, ${centerPoint.y}`
              );
              io.in(battlefield.id).emit("activePlayerFall", centerPoint);
            });
          
            // playerUsesSkill
            socket.on("playerUsesSkill", (playerId, skill) => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;
          
              console.log(`[playerUsesSkill] ${skill} battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
                }`);
              io.in(battlefield.id).emit("playerUsesSkill", skill);
            });
          
            // activePlayerFire
            socket.on("activePlayerFire", (firingData) => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;
          
              console.log(`[activePlayerFire] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
                }`);
              battlefield.isActivePlayerFiring = true
              io.in(battlefield.id).emit("activePlayerFire", firingData);
            });
          
            socket.on("syncBombDataBeforePlayerFires", (bombsData, isTrident) => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;
          
              console.log(
                `[syncBombDataBeforePlayerFires] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
                }`
              );
              io.in(battlefield.id).emit("syncBombDataBeforePlayerFires", bombsData, isTrident);
            });

            // bombBombedInBattlefield
            socket.on('bombBombedInBattlefield', ({bombTarget, playerInfo}) => {
              const battlefield = playerInfos.getBattlefield(playerId);

              console.log(`[bombBombedInBattlefield] ${playerId} ${battlefield.id} ${bombTarget.bombId}`);

              if(!battlefield) {
                return
              }

              // 如果对 player 有影响，则更新 battlefield里的 playerInfo
              if(playerInfo) {
                battlefield.updatePlayerInfoInBattlefield(playerInfo)
              }
              
              // 如果该 bomb 已经被记录了，则 return
              if(battlefield.getBombTarget(bombTarget.bombId)) {
                return
              }

              // 记录
              battlefield.addBombTarget(bombTarget)
              // console.log('battlefield.validBombTargets', battlefield.validBombTargets)
            })
          
            // startNextTurn
            socket.on("startNextTurn", () => {
              const battlefield = playerInfos.getBattlefield(playerId);
              if (!battlefield) return;
          
              battlefield.isActivePlayerFiring = false
              battlefield.calculateActivePlayerIndex();
              console.log(`[startNextTurn] battlefieldId: ${battlefield.id} activePlayer: ${battlefield.activePlayer.id}
                }`);

              if(battlefield.playerIdsOnReconnection.length === 0) {
                io.in(battlefield.id).emit("startNextTurn", {
                  activePlayerId: battlefield.activePlayer.id
                });
              }
              else {
                // 有在 nextTurn 重连的 players
                const data = {
                  reconnectionPlayerIds: battlefield.playerIdsOnReconnection,
                  validBombTargets: battlefield.validBombTargets,
                  activePlayerId: battlefield.activePlayer.id,
                  playersData: battlefield.players
                }

                for(let _playerId of battlefield.playerIdsOnReconnection) {
                  playerInfos.setIsReconnection(_playerId, false)
                }
                battlefield.playerIdsOnReconnection = []

                io.in(battlefield.id).emit("startNextTurn", data);
              }
            });

            // leaveBattlefield
            socket.on("leaveBattlefield", () => {
              console.log(`[leaveBattlefield] ${playerId}`);

              try {
                const playerInfo = playerInfos.get(playerId);

                const battlefield = playerInfo.battlefield
                if(!battlefield) {
                  throw new Error(`${playerId} battlefield is null`);
                }
  
                // 离开 battlefield
                socket.leave(battlefield.id)
                battlefield.remove(playerId)
  
                // 通知 battlefield
                io.in(battlefield.id).emit('leaveBattlefield', playerId)
  
                // 更新 playerInfo 的 battlefield 为 null
                playerInfos.setBattlefield(playerId, null)
  
                // 更新 playerInfo 的 isReconnection 为 false （好像不太需要）
                // playerInfos.setIsReconnection(playerId, false)
  
                // 当battlefield中没有玩家时，销毁battlefield
                if (battlefield.playerNum === 0) {
                  console.log(`[dispose battlefield] ${battlefield.id}`);
                  battlefield.dispose();
                }
              } catch (error) {
                
              }
            })
        }
        catch (err) {
            console.error('connection failed: 身份认证失败', err)
        }
      });

      // const matchmakingNamespace = io.of("/matchmaking");
      // const battlefieldNamespace = io.of("/battlefield");

      
      // matchmakingNamespace.on("connection", (socket) => {
      //   const playerId = socket.handshake.auth.token;
      
      //   console.log(`[matchmaking/connected] ${playerId} connected!`);
      
      //   socket.on("requestMatching", (player) => {
      //     console.log(`[matchmaking/requestMatching] ${player.id}`);
      //     if (matchingPool.has(player.id)) return;
      //     matchingPool.add(player);
      //     const matchedPlayers = matchingPool.tryToMatch(player);
      //     if (matchedPlayers) {
      //       console.log("[matchmaking/matchmakingCompleted]", matchedPlayers);
      
      //       // battlefield
      //       const battlefield = new Battlefield();
      
      //       matchmakingNamespace.emit(
      //         "matchmakingCompleted",
      //         matchedPlayers,
      //         battlefield.id
      //       );
      //       matchedPlayers.forEach((player, index) => {
      //         // 将 players加入 battlefield
      //         battlefield.add(player, index);
      
      //         // 将player, battlefield 关联
      //         playerInfos.add(player.id);
      //         playerInfos.setBattlefield(player.id, battlefield);
      //       });
      //     }
      //   });
      
      //   // cancelMatching
      //   socket.on("cancelMatching", () => {
      //     console.log(`[matchmaking/cancelMatching] ${playerId}`);
      
      //     matchingPool.remove(playerId);
      //   });
      
      //   socket.on("disconnect", (reason) => {
      //     console.log(`[matchmaking/disconnected] ${playerId} reason: ${reason}`);
      
      //     switch (reason) {
      //       case "client namespace disconnect": {
      //         // 客户端主动断开连接
      
      //         break;
      //       }
      
      //       case "transport close": {
      //         // 客户端网络异常断开连接 / 客户端关闭浏览器
      
      //         // 玩家在比赛中
      
      //         break;
      //       }
      
      //       default: {
      //         break;
      //       }
      //     }
      
      //     // remove from matchmakingPool (if exists)
      //     matchingPool.remove(playerId);
      
      //     // players = players.filter(player => player.id !== playerId)
      //   });
      // });
      
      // battlefieldNamespace.on("connection", (socket) => {
      //   const playerId = socket.handshake.auth.token;
      
      //   console.log(`[battlefield/connected] ${playerId} connected!`);
      
      //   const playerInfoSocket = playerInfos.getSocket(playerId);
      //   const battlefield = playerInfos.getBattlefield(playerId);
      //   if(!battlefield) {
      //     console.log('battlefield is null')
      //     return
      //   }
      //   // join battlefield (room)
      //   socket.join(battlefield.id);
      //   if (!playerInfoSocket) {
      //     // new connection
      //     playerInfos.setSocket(playerId, socket);
      //     playerInfos.setIsReconnection(playerId, false);
      //   } else {
      //     // reconnect
      //     // 断开之前的socket，并替换为新的socket
      //     playerInfoSocket.leave(battlefield.id);
      //     playerInfoSocket.disconnect();
      //     playerInfos.setSocket(playerId, socket);
      //     playerInfos.setIsReconnection(playerId, true);
      //   }
      
        // socket.on("disconnect", (reason) => {
        //   console.log(`[battlefield/disconnected] ${playerId} reason: ${reason}`);
        //   const battlefield = playerInfos.getBattlefield(playerId);
      
        //   switch (reason) {
        //     case "client namespace disconnect": {
        //       // 客户端主动断开连接
      
        //       // 主动退出比赛
        //       console.log(`[battlefield/playerLeaveGame] ${playerId}`);
      
        //       // 移除battlefield中的player
        //       battlefield.remove(playerId);
      
        //       // 通知其他玩家
        //       battlefieldNamespace.in(battlefield.id).emit("playerLeaveGame", playerId);
      
        //       // 当battlefield中没有玩家时，销毁battlefield
        //       if (battlefield.playerNum === 0) {
        //         console.log(`[dispose battlefield] ${battlefield.id}`);
        //         battlefield.dispose();
        //       }
      
        //       // 移除playerInfo
        //       playerInfos.remove(playerId);
      
        //       console.log(
        //         `playerInfos(${playerInfos.size}):`,
        //         playerInfos.getPlayerIds()
        //       );
        //       break;
        //     }
      
        //     case "transport close": {
        //       // 客户端网络异常断开连接 / 客户端关闭浏览器
      
        //       // 玩家在比赛中
        //       console.log(`[battlefield/playerOffline] ${playerId}`);
        //       battlefield.setPlayerIsOnline(playerId, false);
        //       // 通知其他玩家
        //       battlefieldNamespace.in(battlefield.id).emit("playerOffline", playerId);
        //       break;
        //     }
      
        //     default: {
        //       break;
        //     }
        //   }
        // });
      
        // socket.on("joinBattlefield", () => {
        //   const { battlefield, isReconnection } = playerInfos.get(playerId);
      
        //   if (isReconnection) {
        //     // 如果是重连
        //     console.log(`[battlefield/reconnectBattlefield] ${playerId}`);
        //     // player重新连接：同步数据，并通知其他玩家，
        //     const data = {
        //       reconnectionPlayerId: playerId,
        //       activePlayerId: battlefield.activePlayer.id,
        //       players: battlefield.players
        //     }
        //     battlefieldNamespace.in(battlefield.id).emit("playerReconnectsBattlefield", data);
        //   } else {
        //     // 如果是第一次
        //     console.log(
        //       `[battlefield/joinBattlefield] ${playerId} ${battlefield.id}`
        //     );
        //     battlefield.setPlayerIsOnline(playerId, true);
      
        //     if (battlefield.isAllOnlie) {
        //       battlefield.activePlayerIndex = 0;
        //       const data = {
        //         activePlayerId: battlefield.activePlayer.id,
        //         players: battlefield.players
        //       };
        //       console.log("[battlefield/initBattlefield]", data);
        //       battlefieldNamespace.in(battlefield.id).emit("initBattlefield", data);
        //     }
        //   }
        // });
      
        // // activePlayerMove
        // socket.on("activePlayerMove", (direction) => {
        //   const battlefield = playerInfos.getBattlefield(playerId);
        //   if (!battlefield) return;
        //   console.log(
        //     `battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
        //     } activePlayerMove ${direction}`
        //   );
        //   battlefieldNamespace.in(battlefield.id).emit("activePlayerMove", direction);
        // });
      
        // socket.on("activePlayerMoveEnd", (centerPoint, direction) => {
        //   const battlefield = playerInfos.getBattlefield(playerId);
        //   if (!battlefield) return;
      
        //   console.log(
        //     `[activePlayerMoveEnd] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
        //     } x, y: ${centerPoint.x}, ${centerPoint.y} direction: ${direction}`
        //   );
      
        //   const player = battlefield.getPlayer(playerId)
        //   if (!player) {
        //     console.log(`player ${playerId} is null`)
        //     return
        //   }
      
        //   player.centerPoint = centerPoint
        //   player.direction = direction
      
        //   battlefieldNamespace.in(battlefield.id).emit("activePlayerMoveEnd", centerPoint, direction);
        // });
      
        // socket.on("activePlayerFall", (centerPoint) => {
        //   const battlefield = playerInfos.getBattlefield(playerId);
        //   if (!battlefield) return;
      
        //   console.log(
        //     `[activePlayerFall] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
        //     } x, y: ${centerPoint.x}, ${centerPoint.y}`
        //   );
        //   battlefieldNamespace.in(battlefield.id).emit("activePlayerFall", centerPoint);
        // });
      
        // // playerUsesSkill
        // socket.on("playerUsesSkill", (playerId, skill) => {
        //   const battlefield = playerInfos.getBattlefield(playerId);
        //   if (!battlefield) return;
      
        //   console.log(`[playerUsesSkill] ${skill} battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
        //     }`);
        //   battlefieldNamespace.in(battlefield.id).emit("playerUsesSkill", skill);
        // });
      
        // // activePlayerFire
        // socket.on("activePlayerFire", (firingData) => {
        //   const battlefield = playerInfos.getBattlefield(playerId);
        //   if (!battlefield) return;
      
        //   console.log(`[activePlayerFire] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
        //     }`);
        //   battlefieldNamespace.in(battlefield.id).emit("activePlayerFire", firingData);
        // });
      
        // socket.on("syncBombDataBeforePlayerFires", (bombsData, isTrident) => {
        //   const battlefield = playerInfos.getBattlefield(playerId);
        //   if (!battlefield) return;
      
        //   console.log(
        //     `[syncBombDataBeforePlayerFires] battlefieldId: ${battlefield.id} ${battlefield.activePlayer.id
        //     }`
        //   );
        //   battlefieldNamespace.in(battlefield.id).emit("syncBombDataBeforePlayerFires", bombsData, isTrident);
        // });
      
        // // startNextTurn
        // socket.on("startNextTurn", () => {
        //   const battlefield = playerInfos.getBattlefield(playerId);
        //   if (!battlefield) return;
      
        //   battlefield.calculateActivePlayerIndex();
        //   console.log(`[startNextTurn] battlefieldId: ${battlefield.id} activePlayer: ${battlefield.activePlayer.id}
        //     }`);
        //   battlefieldNamespace.in(battlefield.id).emit("startNextTurn", {
        //     activePlayerId: battlefield.activePlayer.id
        //   });
        // });
      // });
}

export default initWs