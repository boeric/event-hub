/* global d3 */
/* eslint-disable no-console, no-bitwise, func-names, max-len */

window.onload = () => {
  // Variables
  let id;
  let socket;
  let socketOpen = false;
  let paused = false;
  const rateControlConfig = {
    min: 1,
    max: 100,
    value: 5,
    step: 1,
  };
  const rateControlLabelStr = `${rateControlConfig.value} sec`;


  function pauseButtonClick(ref) {
    ref.blur();

    // Send a pause message to the system (server and all client and analytics instances)
    // Do Not modify the the state here, as doing so would cause inconsitencies in other
    // analytics instances. Instead, update the state in the eventhandler receiving the just
    // sent pause message
    const packet = {
      data: !paused,
      id,
      source: 'analytics',
      type: 'pause',
    };

    if (socketOpen) {
      socket.send(JSON.stringify(packet));
    }
  }

  function resetButtonClick(ref) {
    ref.blur();

    const packet = {
      source: 'analytics',
      type: 'reset',
      id,
    };

    if (socketOpen) {
      socket.send(JSON.stringify(packet));
    }
  }

  function rateControlChange(ref) {
    const { value } = ref;
    console.log('rateControlChange', ref.value);
    rateControlConfig.value = value;
    d3.select('#rate-control-label').text(`${value} sec`);
  }

  function rateControlInput(ref) {
    const { value } = ref;
    console.log('rateControlInput', ref.value);
    rateControlConfig.value = value;
    d3.select('#rate-control-label').text(`${value} sec`);
  }

  function updateClientData(payload) {
    const {
      clientCount,
      clients,
      // timestamp,
    } = payload;
    const now = Date.now();

    d3.select('.client-connected-container')
      .text(`Currently connected clients: ${clientCount}`);

    const container = d3.select('.client-state-container');
    const updateSelection = container.selectAll('.client-state').data(clients);

    // Remove lost clients
    const exitSelection = updateSelection.exit();
    exitSelection.remove();

    // Update clients
    updateSelection.select('p').text((d) => `Id: ${d.id}, Ip: ${d.remoteAddress}, Uptime: ${~~((now - d.startTime) / 1000)}s`);
    updateSelection.select('pre').text((d) => JSON.stringify(d.state, null, 2));

    // Add clients
    const enterSelection = updateSelection.enter().append('div').attr('class', 'client-state');
    enterSelection.append('p').text((d) => `Id: ${d.id}`);
    enterSelection.append('pre').text((d) => JSON.stringify(d.state, null, 2));
  }

  function serverMessageHandler(msg) {
    const { data: msgData } = msg;
    const payload = JSON.parse(msgData);
    const { data, type } = payload;

    switch (type) {
      case 'analytics':
        updateClientData(payload);
        break;

      // TBD
      case 'config':
        break;

      case 'pause':
        // Update local variable
        paused = data;

        // Update button text
        d3.select('.pause').text(paused ? 'Unpause' : 'Pause');
        break;

      default:
        console.error(`Unsupported type: ${type}`);
    }
  }

  // Initialize websockets if supported by the browser
  if ('WebSocket' in window) {
    const { host, href } = window.location;

    const websocketUrl = `ws://${host}`;

    // Generate id (should be a guid...)
    id = `${~~(Math.random() * 90000000 + 10000000)}`;

    // Create WebSocket connection.
    socket = new WebSocket(websocketUrl);

    // Socket open event
    socket.onopen = () => {
      console.log('websockets open');

      // Send an init message
      socketOpen = true;
      let packet = {
        source: 'analytics',
        type: 'init',
        id,
      };

      socket.send(JSON.stringify(packet));

      // Then send an unpause message to the system (server, client and analytics instances)
      packet = {
        data: false, // Unpause everybody
        id,
        source: 'analytics',
        type: 'pause',
      };

      if (socketOpen) {
        socket.send(JSON.stringify(packet));
      }
    };

    // Socket close event
    socket.onclose = () => {
      console.log('websockets closed');
      socketOpen = false;
    };

    // Socket message event
    socket.onmessage = serverMessageHandler;

    // Bind event handlers to controls
    d3.select('.pause').on('click', function () {
      pauseButtonClick(this);
    });

    d3.select('.reset').on('click', function () {
      resetButtonClick(this);
    });

    d3.select('#rate-control')
      .property('max', rateControlConfig.max)
      .property('min', rateControlConfig.min)
      .property('step', rateControlConfig.step)
      .property('value', rateControlConfig.value)
      .on('change', function () { rateControlChange(this); })
      .on('input', function () { rateControlInput(this); });

    d3.select('#rate-control-label').text(rateControlLabelStr);

    // Done
    console.log(`analytics.js script done, loaded from ${href}`);
  } else {
    // No websockets support
    console.error('No websocket support in this browser');
  }
};
