import { createServer } from "http";

import app from "./utils/http.js";
import initWs from "./utils/ws.js";

const httpServer = createServer(app.callback());
initWs(httpServer)

const port = 3000
httpServer.listen(port, () => {
  console.log(`server is running at http://127.0.0.1:${port}`);
});
