/* eslint-disable import/no-unresolved, no-console, no-nested-ternary, no-plusplus, max-len */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Constants
const port = 5000; // HTTP port
const throttle = 1000; // Controls the ws data rate to the analytics clients, min ms between tx
let lastTxTimestamp = Date.now(); // Last websockets tx to the analytics clients

const defaultConfig = {
  type: 'config',
  data: {
    realtimeEvents: [ // These events will be transmitted in realtime
      // 'scroll', // Uncomment to receive in realtime
      // 'mousemove',
    ],
    userActiveTimeout: 10000, // 10 sec
    updateFrequency: 2000, // 2 sec
    paused: true, // Pause the client until unpaused by an analytics client
  },
};

const defaultAnalyticsConfig = {
  type: 'config',
  data: {},
};

// Update analytics clients
function updateAnalyticsClients(wss, analytics) {
  // Determine whether to update the analytics clients
  const now = Date.now();
  const updateNow = (now - lastTxTimestamp) > throttle;

  if (updateNow) {
    // Update timestamp of last websockets tx
    lastTxTimestamp = now;

    // Cycle through the analytics clients
    wss.clients.forEach((client) => {
      if (!client.eventHubData) {
        client.send(JSON.stringify(analytics));
      }
    });
  }
}

// Sends the specified resource to client
function sendResource(resource, req, res) {
  const type = { 'Content-Type': 'text/html' };
  const resourcePath = path.join(__dirname, `${resource}`);

  try {
    // This will throw if file doesn't exist
    fs.statSync(resourcePath);

    // Set response header
    res.writeHead(200, type);

    // Send the file
    const readStream = fs.createReadStream(resourcePath);
    readStream.pipe(res);
    // console.log(`Sent resource ${resourcePath}`);
    return true;
  } catch (e) {
    // File not found (after all these hack attempts, return 401 instead of 404)
    // res.writeHead(404, { 'Content-Type': 'text/html' });
    // res.end('Not found');
    res.writeHead(401, { 'Content-Type': 'text/html' });
    res.end('Unauthorized');
    console.log(`Could not find resource ${resourcePath}`);
    return false;
  }
}

// Create server and listen
const httpServer = http.createServer((req, res) => {
  // const { connection, url, method, headers, client } = req;
  const { connection, url, method } = req;
  const { remoteAddress: address } = connection;

  // Log request
  const time = new Date().toISOString();
  // console.log(`Request at ${time} from: ${address}, url: ${url}, method: ${method}, headers: ${JSON.stringify(headers)}`);
  console.log(`Request at ${time} from: ${address}, url: ${url}, method: ${method}`);

  // Only accept HTTP GET
  if (method !== 'GET') {
    console.log('Request is not GET, returning Unauthorized...');
    res.writeHead(401, { 'Content-Type': 'text/html' });
    res.end('Unauthorized');
    return;
  }

  let resource = url === '/' ? '/index.html' : url;
  resource = resource.includes('.') ? resource : `${resource}.html`;
  sendResource(resource, req, res);
});

// Init websocket server
const wss = new WebSocket.Server({ server: httpServer });
// const wss = new WebSocket.Server({ port: '5001' });

// Handle websocket connection
wss.on('connection', (ws, req) => {
  const { remoteAddress } = req.socket;

  // Add message handler
  ws.on('message', (msg) => {
    // Handle message
    // console.log('received: %s', JSON.stringify(JSON.parse(msg)));
    const parsedMsg = JSON.parse(msg);
    const {
      id,
      data,
      source,
      type,
    } = parsedMsg;
    // console.log('source', source);

    if (source === 'client') {
      const analytics = {
        clientCount: 0, // can't use wss.clients.size because that includes the analytics clients
        clients: [],
        timestamp: Date.now(),
        type: 'analytics',
      };

      switch (type) {
        case 'periodic-event':
          // Set new data
          // eslint-disable-next-line no-param-reassign
          ws.eventHubData = parsedMsg;
          // Add ip address to eventHubData object
          ws.eventHubData.remoteAddress = remoteAddress;

          // Cycle through the clients
          wss.clients.forEach((client) => {
            if (client.eventHubData) {
              analytics.clientCount++;
              analytics.clients.push(client.eventHubData);
            }
          });

          updateAnalyticsClients(wss, analytics);
          break;

        case 'realtime-event':
          // Skip processing realtime events for now
          break;

        case 'init':
          // Send the default client configuration
          ws.send(JSON.stringify(defaultConfig));

          // eslint-disable-next-line no-param-reassign
          ws.eventHubAnalytics = { source, id };
          // console.log('client init');
          break;

        default:
          console.error(`Unknown event type: ${type}`);
      }
    } else if (source === 'analytics') {
      // Handle messages from 'analytics' clients
      let packet;

      switch (type) {
        case 'init':
          // Send the default client configuration
          ws.send(JSON.stringify(defaultAnalyticsConfig));
          break;

        case 'pause':
          // Update default config so new clients get the current state
          defaultConfig.data.paused = data;

          // Create message
          packet = { type, data };

          // Cycle through All clients (this way the both regular and analytics
          // clients have the same state)
          wss.clients.forEach((client) => {
            client.send(JSON.stringify(packet));
          });
          break;

        case 'reset':
          break;

        default:
          console.error(`Unknown type ${type}`);
      }
    }
  });
});

// Start the http server
httpServer.listen(port);
console.log(`Server is up and listening on port ${port}...`);
