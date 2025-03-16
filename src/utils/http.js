import Koa from "koa"
import cors from "@koa/cors";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";
import jwt from "jsonwebtoken"
import serve from "koa-static"
import path from 'path'
import fs from "fs"
import { fileURLToPath } from 'url';

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

// 设置静态文件目录
// const __dirname = path.dirname(new URL(import.meta.url).pathname);
// const filePath = path.join(__dirname, 'dist', 'index.html');

// console.log(import.meta.url) // file:///D:/VScodeWorks/ddt/ddt-s/src/utils/http.js 
// console.log(fileURLToPath(import.meta.url)) // D:\VScodeWorks\ddt\ddt-s\src\utils\http.js

const staticPath = path.join(fileURLToPath(import.meta.url), '../../../', 'dist') 
app.use(serve(staticPath)); 
// console.log(staticPath, path.join(staticPath, 'index.html'));
console.log(staticPath); // D:\VScodeWorks\ddt\ddt-s\dist

// 处理 SPA 的路由回退q
// app.use(async (ctx) => {
//     ctx.type = 'html';
//     ctx.body = fs.createReadStream(path.join(staticPath, 'index.html'));
//   });

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
  console.log(`${new Date().toLocaleString()} ${method} ${path} [${ctx.status}] ${elapsed}ms`)
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

      // 放行
      await next()

      // 如果本身就是 请求newToken的请求 则 return
      if(ctx.path.includes('/newToken')) return

      const remainingSeconds = decoded.exp - Date.now() / 1000 
      if(remainingSeconds > TOKEN_REFRESH_THRESHOLD) return

      // 如果 token 快要过期了
      if(ctx.response.body && typeof ctx.response.body === 'object') {
        const userInfo = {
            id: decoded.id,
            name: decoded.name,
        }

        // 则生成新 token 并返回
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