/* global d3 */
/* eslint-disable no-console, no-bitwise, no-plusplus, no-param-reassign, max-len */

// Variables
const consolidatorInterval = 1000; // 1 sec
let id; // Instance id
let intervalId = null; // Id for setInterval
const startTime = Date.now();

// Please note that config will be updated by the server upon websockets init
let config = {
  realtimeEvents: [], // No realtime events
  userActiveTimeout: 100000, // 100 sec
  updateFrequency: 20000, // 20 sec
  paused: true, // Set initial state to true
};

// Websockets
let socketOpen = false;
let socket;

// Event buffer and state
let newEvents = [];
const state = {
  userActive: false,
  lastTimestamp: Date.now(),
  totalEvents: 0,
  eventSummary: {},
};


// Updates the UI with current stats (in production, this would be removed)
function update() {
  const { eventSummary, totalEvents } = state;
  const { updateFrequency } = config;
  const socketStr = `${socketOpen ? 'open' : 'closed'}`;

  const eventCountNew = Object.keys(eventSummary).reduce((ac, type) => {
    const { count } = eventSummary[type];
    return ac + count;
  }, 0);

  const eventTypeCount = Object.keys(eventSummary).length;
  d3.select('.state-row0').text(`Instance Id: ${id}, Paused: ${config.paused}, Server update interval: ${updateFrequency / 1000}s, Websockets: ${socketStr}`);
  d3.select('.state-row1').text(`Events: ${totalEvents} (realtime), ${eventCountNew} (consolidator), Event types seen: ${eventTypeCount}`);
}

function eventConsolidator() {
  // Process the event array
  const lastEventSummary = newEvents.reduce((ac, event) => {
    const {
      data,
      timestamp,
      type,
    } = event;

    if (ac[type] === undefined) {
      ac[type] = { count: 0, data: undefined };
    }

    // Accumulate count of the same type
    ac[type].count++;

    // Add the data of the last event
    ac[type].data = data;

    // Add the timestamp of the last event
    ac[type].timestamp = timestamp;

    return ac;
  }, {});

  // Reset the event array
  newEvents = [];

  // Update the event summary object
  const { eventSummary } = state;

  // Process the last events and consolidate into event summary object
  Object.keys(lastEventSummary).forEach((type) => {
    const {
      count,
      data,
      timestamp,
    } = lastEventSummary[type];

    if (eventSummary[type] === undefined) {
      eventSummary[type] = { count: 0, data: undefined };
    }

    // Accumulate count of the same type
    eventSummary[type].count += count;

    // Add the last (current) data sample
    eventSummary[type].data = data;

    // Add the timestamp of the last event
    eventSummary[type].timestamp = timestamp;
  });

  // Update the UI
  update();
}

// Start the consolidator
setInterval(eventConsolidator, consolidatorInterval);


// Triggers on a periodic basis to send current event state from this instance to the server
function stateSampler() {
  // Determine if the user is active
  const timestamp = Date.now();
  const timeElapsed = timestamp - state.lastTimestamp;
  state.userActive = timeElapsed < config.userActiveTimeout;

  // Create message for transmission to server
  const packet = {
    source: 'client',
    type: 'periodic-event',
    id,
    state,
    startTime,
  };

  // Send to server
  if (socketOpen) {
    socket.send(JSON.stringify(packet));
  }

  // Update the UI
  update();
}

// Start the state sampler
if (!config.paused) {
  intervalId = setInterval(stateSampler, config.updateFrequency);
}

// The event hub, globally exposed on the window object, is called by the event generators for
// each event
// Please note: the event hub is completely ignorant of the content of the events
function eventhub(event) {
  const { type } = event;

  // Add this event to the new events array
  newEvents.push(event);

  // Update timestamp and event count
  state.lastTimestamp = Date.now();
  state.totalEvents++;

  // Determine whether to dispatch this event immediately (realtime) to the server
  if (config.realtimeEvents.includes(type)) {
    // Create message for transmission to the server
    const packet = {
      event,
      id,
      source: 'client',
      startTime,
      type: 'realtime-event',
    };

    if (socketOpen) {
      // Sent the event immediately to server
      socket.send(JSON.stringify(packet));
    }
  }

  // Update the UI
  update();
}

function serverMessageHandler(msg) {
  const { data: eventData } = msg;
  const payload = JSON.parse(eventData);
  // console.log('websocket data', payload);
  const { data, type } = payload;

  switch (type) {
    // Update the configuration
    case 'config':
      config = data;
      if (config.paused) {
        clearInterval(intervalId);
        intervalId = null;
      } else {
        intervalId = setInterval(stateSampler, config.updateFrequency);
      }
      break;

    // Pause/Unpause the transmission of event summary messages to the server
    // Please note: events are internally captured continously regardless of whether the outbound
    // transmission is paused or not
    case 'pause':
      config.paused = data;
      if (config.paused) {
        clearInterval(intervalId);
        intervalId = null;
      } else {
        intervalId = setInterval(stateSampler, config.updateFrequency);
      }
      break;

    // TBD: will flush the internal event buffer
    case 'flush':
      console.log('flush');
      break;

    // TBD: Change the frequency of transmission of event summary messages to the server
    case 'rateControl':
      console.log('ratecontrol');
      break;

    default:
      // console.error(`Unsupported type: ${type}, payload: ${eventData}`);
  }
}

// Initialize websockets if supported by the browser
if ('WebSocket' in window) {
  const { host, href } = window.location;
  const websocketUrl = `ws://${host}`;
  // console.log('websocketUrl', websocketUrl);

  // Generate id (should be a guid...)
  id = `${~~(Math.random() * 900000 + 100000)}`;

  // Create WebSocket connection.
  socket = new WebSocket(websocketUrl);

  // Socket open event
  socket.onopen = () => {
    console.log('websockets open');
    socketOpen = true;

    // Create initial message to the server
    const packet = {
      id,
      source: 'client',
      startTime,
      type: 'init',
    };

    socket.send(JSON.stringify(packet));

    // Update the UI
    update();
  };

  // Socket close event
  socket.onclose = () => {
    console.log('websockets closed');
    socketOpen = false;
  };

  // Socket message event
  socket.onmessage = serverMessageHandler;

  // Install event hub on the window object
  window.eventhub = eventhub;

  // Done
  console.log(`eventhub.js script done, loaded from ${href}`);
} else {
  // No websockets support
  console.error('No websocket support in this browser');
}
