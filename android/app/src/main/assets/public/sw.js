/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "7133acef6e2c16de81db42a0275628db"
  }, {
    "url": "pwa-512x512.png",
    "revision": "7133acef6e2c16de81db42a0275628db"
  }, {
    "url": "pwa-192x192.png",
    "revision": "dd124f2490f3bb36792db821564ff87d"
  }, {
    "url": "index.html",
    "revision": "668f1b43694fd7847b00ac16c9e17ddd"
  }, {
    "url": "icon.svg",
    "revision": "1229b5ce14c99f6cde5ebe780f08ce8e"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2f8cdef791919f3682e07f8992725baf"
  }, {
    "url": "assets/rolldown-runtime-CbXtAM7H.js",
    "revision": null
  }, {
    "url": "assets/purify.es-Bvo9QlJ8.js",
    "revision": null
  }, {
    "url": "assets/index.es-D6BUZeWZ.js",
    "revision": null
  }, {
    "url": "assets/index-lBHyj-G7.js",
    "revision": null
  }, {
    "url": "assets/index-BQoTmojq.css",
    "revision": null
  }, {
    "url": "assets/html2canvas-BM5yyqGY.js",
    "revision": null
  }, {
    "url": "assets/AdminPanel-DN7nbCTv.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2f8cdef791919f3682e07f8992725baf"
  }, {
    "url": "icon.svg",
    "revision": "1229b5ce14c99f6cde5ebe780f08ce8e"
  }, {
    "url": "pwa-192x192.png",
    "revision": "dd124f2490f3bb36792db821564ff87d"
  }, {
    "url": "pwa-512x512.png",
    "revision": "7133acef6e2c16de81db42a0275628db"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "7133acef6e2c16de81db42a0275628db"
  }, {
    "url": "manifest.webmanifest",
    "revision": "166e8588afee71f5eb109ad3206b0cc9"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
