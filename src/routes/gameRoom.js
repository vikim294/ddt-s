import Router from "koa-router";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import { v4 as uuidv4 } from 'uuid';

import pool from "../utils/db.js"
import { redis } from "../utils/redis.js";
import { gameRooms } from "../libs/gameRoom.js";
import { getUserById } from "../services/user.js";

const router = new Router({
    prefix: '/gameRoom'
})

/**
 * 创建gameRoom
 */
// router.post('/createGameRoom', async (ctx) => {
//     const {
//       uid
//     } = ctx.request.body

//     // 生成gameRoom id
//     const gameRoomId = uuidv4()

//     // 存 redis
//     const data = {
//         id: gameRoomId,
//         players: [{
//             id: uid
//         }]
//     }

//     await redis.set(`gameRoom_${gameRoomId}`, JSON.stringify(data))
   
//     ctx.body = {
//         msg: '新建房间成功',
//         data: {
//             gameRoomId
//         }
//     }
// })

/**
 * 获取gameRoom
 */
router.get('/info', async (ctx) => {
    const {
      gameRoomId
    } = ctx.request.query

    const gameRoom = gameRooms.getRoomById(gameRoomId)
    if(!gameRoom) {
        ctx.status = 400
        ctx.body = {
            msg: '没有找到房间',
        }
    }
    else {
        ctx.body = {
            msg: '查询房间成功',
            data: {
                gameRoom
            }
        }
    }
})

/**
 * 获取gameRoomList
 */
router.get('/list', async (ctx) => {
    const gameRoomList = gameRooms.rooms.map(room => {
        return {
            id: room.id,
            playerNum: room.players.length,
            size: room.size,
            status: room.status
        }
    })
    ctx.body = {
        msg: '查询房间列表成功',
        data: {
            gameRoomList
        }
    }
})

/**
 * 加入gameRoom
 */
router.post('/enter', async (ctx) => {
    console.log('gameRooms', gameRooms)

    const {
        gameRoomId,
        userId
    } = ctx.request.body

    // 判断房间是否存在
    const gameRoom = gameRooms.getRoomById(gameRoomId)
    if(!gameRoom) {
        ctx.status = 400
        ctx.body = {
            msg: '该房间不存在',
        }

        return
    }

    // 判断房间是否已满
    if(gameRoom.players.length === gameRoom.size) {
        ctx.status = 400
        ctx.body = {
            msg: '该房间已满',
        }

        return
    }

    // 判断房间是否已开始
    if(gameRoom.status === 'started') {
        ctx.status = 400
        ctx.body = {
            msg: '该房间已开始',
        }

        return
    }

    // 查找用户信息
    const user = await getUserById(userId)

    // 加入房间
    gameRoom.addPlayer(user)
    
    ctx.body = {
        msg: '加入房间成功',
    }
})

export default router
