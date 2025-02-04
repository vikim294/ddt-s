import Router from "koa-router";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

import pool from "../utils/db.js"
import { redis } from "../utils/redis.js";
import { JWT_SECRET } from "../utils/constant.js";

const router = new Router({
    prefix: '/user'
})

/**
* 注册
*/
router.post('/register', async (ctx) => {
    // 解析 username 和 password
    const {
        username, password
    } = ctx.request.body

    if (!username || !password) {
        ctx.status = 400
        ctx.body = {
            msg: '用户名和密码必填！'
        }

        return
    }

    // 判断db中是否已存在该 username
    const [rows] = await pool.query(`
        SELECT * FROM user
        WHERE name = '${username}'
    `)

    if (rows.length > 0) {
        ctx.status = 400
        ctx.body = {
            msg: '用户名已存在',
        }

        return
    }

    // --- 用户名有效 将信息存入数据库

    // 密码加密
    const saltRounds = 10;
    const hashedPwd = await bcrypt.hash(password, saltRounds)

    const [res] = await pool.query(`
        INSERT INTO user (name, password)
        VALUES ('${username}', '${hashedPwd}')
    `)

    if (res.affectedRows === 1) {
        ctx.body = {
            msg: '注册成功',
        }
    }
    else {
        ctx.status = 500
        ctx.body = {
            msg: '注册失败'
        }
    }
})

/**
* 登录
*/
router.post('/login', async (ctx) => {
    // 解析 username 和 password
    const {
        username, password
    } = ctx.request.body

    if (!username || !password) {
        ctx.status = 400
        ctx.body = {
            msg: '用户名和密码必填！'
        }

        return
    }

    // 判断db中是否已存在该 username
    const [rows] = await pool.query(`
        SELECT * FROM user
        WHERE name = '${username}'
    `)

    if (rows.length === 0) {
        ctx.status = 400
        ctx.body = {
            msg: '用户名或密码错误',
        }

        return
    }

    // --- 用户名存在 检查密码
    const user = rows[0]
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        ctx.status = 400
        ctx.body = {
            msg: '用户名或密码错误',
        }

        return
    }

    // 检查通过 生成 JWT
    const userInfo = {
        id: user.id,
        name: user.name,
    }

    const token = jwt.sign(userInfo, JWT_SECRET, {
        // 过期时间
        expiresIn: '1h'
    })

    userInfo.token = token

    ctx.body = {
        msg: '登录成功',
        data: {
            userInfo,
        }
    }
})

/**
* 获取用户列表
*/
router.get('/users', async (ctx) => {
    const [rows] = await pool.query(`
        SELECT * FROM user
    `)

    ctx.body = {
        msg: '获取用户列表成功',
        data: {
            rows
        }
    }
})

export default router
