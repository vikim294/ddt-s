import Koa from "koa"
import cors from "@koa/cors";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";
import jwt from "jsonwebtoken"

import userRoutes from "../routes/user.js"
import gameRoomRoutes from "../routes/gameRoom.js"
import { JWT_SECRET, TOKEN_REFRESH_THRESHOLD } from "./constant.js";

const app = new Koa();
const router = new Router()

/**
 * 全局错误处理中间件
 */

app.use(async (ctx, next) => {
  try {
      await next()
  }
  catch (err) {
      ctx.status = 500
      ctx.body = {
          msg: err.message || '服务器端错误'
      }
      console.error('服务器端错误', err)
  }
})

// cors
app.use(cors())

// bodyParser
app.use(bodyParser({
    // 解析失败时 抛出错误
    onerror: (err, ctx) => {
        ctx.throw(400, 'invalid request body')
    }
}))

/**
 * 全局log中间件
 */

app.use(async (ctx, next) => {
  const {
      path, method
  } = ctx
  const now = performance.now()

  await next()

  const elapsed = Math.ceil(performance.now() - now)
  console.log(`
      ********************************************
      ${new Date().toLocaleString()} ${method} ${path} [${ctx.status}] ${elapsed}ms
      ********************************************
  `)
})

/**
* 全局auth中间件
*/
app.use(async (ctx, next) => {
  // 如果是 注册和登录 请求，则“放行”
  if (ctx.path.includes('/register') || ctx.path.includes('/login')) {
      await next()
      return
  }

  // 否则 检查 token
  const token = ctx.headers.authorization
  // 没有 token
  if (!token) {
      ctx.status = 401
      ctx.body = {
          msg: '身份认证失败'
      }

      return
  }

  try {
      // 检查 token
      var decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
      // console.log('decoded', decoded)

      await next()

      // 如果 token 快要过期了，则生成新 token 并返回
      if(ctx.path.includes('/newToken')) return

      const remainingSeconds = decoded.exp - Date.now() / 1000 
      if(remainingSeconds > TOKEN_REFRESH_THRESHOLD) return

      if(ctx.response.body && typeof ctx.response.body === 'object') {
        const userInfo = {
            id: decoded.id,
            name: decoded.name,
        }

        const token = jwt.sign(userInfo, JWT_SECRET, {
            // 过期时间
            expiresIn: '1h'
        })

        ctx.response.body.data.token = token
      }

  }
  catch (err) {
      // token 失效了
      ctx.status = 401
      ctx.body = {
          msg: '身份认证失败'
      }
      console.error('身份认证失败', err)
  }
})

// router
app.use(router.routes()).use(router.allowedMethods())

// user routes
app.use(userRoutes.routes()).use(userRoutes.allowedMethods())

// gameRoom routes
app.use(gameRoomRoutes.routes()).use(gameRoomRoutes.allowedMethods())

export default app