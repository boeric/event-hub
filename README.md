# event-hub

The event-hub project demonstrates how to create a central event dispatcher in a web application. The system is comprised of three main components:
- Server
- Client web app
- Analytics web app

### Server

The server is a combined **HTTP** and **Websockets** server. It delivers the required HTML files and related dependencies (assets and scripts). It also establishes a Websockets listener and dispatcher of Websockets messages. The server maintains a default configuration for event handling for each **client**.

The server forwards to the **analytics** app the event summary messages produced by the **client** app.

It also forwards configuration messages from the **analytics** app to the **client** app.

**Please note** that there may be multiple instances of **client** and **analytics** web apps, doesn't matter – all information is distributed to the **full ecosystem** of attached apps.

### Client

The **Client**, more specifically the **eventhub** is the most interesting piece of the project. The client loads an image with some buttons. Two scripts are executed, the **eventhub** and **events**. The former is an event tracker/consolidator/forwarder, and the latter is an event generator.

#### Event Hub

The event manager **eventhub.js** upon init, first checks for Websockets support (and terminates if no such support is available).

It then attempts to establish communication with the **server** over Websockets and sets an event handler for incoming Websockets messages. It then adds the **eventhub** function to the **window** object, making it available to all scripts running in the browser.

At this point the script is now ready for accepting events, either **user action** events, or incoming **Websocket** messages.

The **eventhub** function has a simple, but strict, API requirement of the event it is passed to it. The event **must** be javascript objects, with the three properties **type**, **timestamp** and **data**. The **eventhub** does not care about the content of the **data** property (see **Event Generator** section below for how the **data** property can be used).

The **eventhub** buffers the events, and on a regular basis (currently every 1 sec) **consolidates** the events down to an event summary object. The event buffer is cleared after each such consolidation, ensuring no memory leak.

At a rate determined by the server (and can be further modified by the **Analytics** app), the event hub delivers the event summary object to the server via Websockets (currently by default every 2 sec).

If the **eventhub** is directed to **pause** by the **server** (which would only do so by a message from an **analytics** instance), it will continue to accumulate/consolidate events, but will not forward the event summary until un-paused.

#### Event Generator

The event generator **event.js** establishes event listeners for a variety of user actions. For each event triggered it calls the **eventhub** with an object with the three **required** properties **type**, **timestamp** and **data**.

The **data** property can be anything the specific event generator wants to forward upstream, including **synthetic** or **composite** events. Synthetic events can be various observations of the browser state, triggered for example by `setInterval`, or at event-time when the app is in a particular state. Composite events can be locally aggregated over some period of time (in the specific event handler), then at some point forwared to the **eventhub**.

**Client** web app screenshot:

<img width="996" alt="Client app screenshot" src="https://user-images.githubusercontent.com/4840824/80987025-43efb980-8de6-11ea-9991-b35af9e60df7.png">

### Analytics

The **Analytics** web app discovers the clients currently attached to the server and renders the current event state from each such client. Like the rest of this ecosystem, it communicates over Websockets.

At regular intervals, it receives event summaries from each **Client** instance, via the server, and renders each client in its own pane.

The button **Pause** will forward a ```pause``` message to the server, which in turn will propagate this to all Websockets clients, including ```self```. This means that the originating **Analytics** web app, will only change it's internal pause state after it receives an echo'ed response from the Websockets message it sent. This is to ensure that all **Analytics** clients are in sync.

After receiving the ```pause``` message with value ```true```, each **client** app will stop forwarding its respective event summary. When receiving the ```pause``` mesagge with value ```false``` the clients will be resuming forwarding their respective event summaries, including all accumulated events while being paused.

**Analytics** web app screenshot:

<img width="1035" alt="Analytics app screenshot" src="https://user-images.githubusercontent.com/4840824/80986761-de9bc880-8de5-11ea-9685-189ad16e3d39.png">

**WIP**: The slider to set the reporting frequency of the **clients**, and the **Reset** button.

### Dependencies

- **d3** - Data Driven Documents, v5 (latest), loaded by the browser
- **ws** - Server Websockets support for the Node server

### Main Files
- server.js
- index.html
- analytics.html
- js/eventhub.js
- js/events.js
- js/analytics.js

### How to use

1. Copy the project files to a new directory, for example ```event-hub```.
2. In this directory, install the dependency ```ws```
```
npm install ws
```
3. Start the server either by this
```
node server
```
or this to put the server in a background process
```
node server &
```
or
```
nohup node server &
```
4. In a browser, navigate to ```http://ip-address:5000``` to load an instance of the **client** web app
5. In another browser tab/window, navigate to ```http://ip-address:5000/analytics``` to load an instance of the **analytics** web app
