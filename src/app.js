export {}

import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

let players = []
let activePlayerIndex = null

io.on("connection", (socket) => {
  const playerId = socket.handshake.auth.token
  console.log(`${playerId} connected!`)

  onPlayerConnection({
    playerId,
  })

  socket.on("disconnect", (reason) => {
    console.log(`${playerId} disconnected`)

    players = players.filter(player => player.id !== playerId)
  });

  // activePlayerMove
  socket.on('activePlayerMove', (direction)=>{
    console.log(`${players[activePlayerIndex].id} activePlayerMove ${direction}`)
    io.emit('activePlayerMove', direction)
  })

  // activePlayerFire
  socket.on('activePlayerFire', (firingData)=>{
    console.log(`${players[activePlayerIndex].id} activePlayerFire`)
    io.emit('activePlayerFire', firingData)
  })

  // startNextTurn
  socket.on('startNextTurn', ()=>{
    activePlayerIndex = (activePlayerIndex + 1) % players.length
    console.log(`startNextTurn activePlayer: ${players[activePlayerIndex].id}`)
    io.emit('startNextTurn', {
      activePlayerId: players[activePlayerIndex].id,
    })
  })

});

httpServer.listen(3000, ()=>{
  console.log('server is listening on 3000')
});


function onPlayerConnection({playerId}) {
  if(players.find(player => player.id === playerId)) return
  if(players.length === 0) {
    // 1
    players[0] = {
      id: playerId,
      name: playerId,
      centerPoint: {
        x: 1147,
        y: 385,
      },
      direction: 'right',

      healthMax: 1000,

      weapon: {
        angleRange: 30,
        damage: 250
      },
    }
    return
  }

  if(players.length === 1) {
    // 2
    players[1] = {
      id: playerId,
      name: playerId,
      centerPoint: {
        x: 1546,
        y: 710,
      },
      direction: 'left',

      healthMax: 1000,

      weapon: {
        angleRange: 30,
        damage: 250
      },
    }

    // 匹配完成
    console.log('匹配完成')
    activePlayerIndex = 0
    io.emit('matchCompleted', {
      activePlayerId: players[activePlayerIndex].id,
      players
    })
  }
}