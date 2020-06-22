/* global d3 */
/* eslint-disable no-console, func-names, no-bitwise */

window.onload = () => {
  console.log('Page is loaded');

  // Dispatcher (calls the event hub)
  function dispatch(evt) {
    if ('eventhub' in window) {
      window.eventhub(evt);
    }
  }

  // Enable event generation if websockets is supported by the browser
  if ('WebSocket' in window) {
    // Button events

    // Get reference to the button container
    const buttonContainer = d3.select('.button-container');

    // Track button clicks
    buttonContainer.selectAll('button')
      .on('click', function () {
        this.blur();
        const elem = d3.select(this);
        const text = elem.text();
        const buttonText = text;
        const timestamp = Date.now();

        // Generate event
        const event = {
          type: `button-click-${text}`,
          timestamp,
          data: { button: buttonText },
        };

        dispatch(event);
      });

    buttonContainer.select('.about-button')
      .on('click', function () {
        this.blur();
        console.log('About button clicked', this);
      });

    // Track button hovers, tbd

    // Image container events (mouse movements and scrolls)

    // Get reference to the image container
    const imageContainer = d3.select('.image-container');

    // Track horizontal and vertical scroll
    imageContainer.on('scroll', function () {
      const { scrollLeft, scrollTop } = this;
      const timestamp = Date.now();

      // Generate event
      const event = {
        type: 'scroll',
        timestamp,
        data: {
          scrollLeft,
          scrollTop,
        },
      };

      dispatch(event);
    });

    // Track mouse movements across the image
    imageContainer.on('mousemove', function () {
      const elem = d3.select(this);
      const mousePos = d3.mouse(elem.node());
      const mouseX = Math.max(~~mousePos[0], 0);
      const mouseY = Math.max(~~mousePos[1], 0);
      const timestamp = Date.now();

      // Generate event
      const event = {
        type: 'mousemove',
        timestamp,
        data: {
          mouseX,
          mouseY,
        },
      };

      dispatch(event);
    });

    // Track window resize event
    window.addEventListener('resize', function () {
      const { innerWidth, innerHeight } = this;
      const timestamp = Date.now();

      // Generate event
      const event = {
        type: 'resize',
        timestamp,
        data: {
          innerWidth,
          innerHeight,
        },
      };

      dispatch(event);
    });
  } else {
    console.error('Event generation Not enabled');
  }
  console.log('eventhub.js script done');
};
